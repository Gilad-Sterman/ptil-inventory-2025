import mongodb from 'mongodb'
const { ObjectId } = mongodb

import { dbService } from '../../services/db.service.js'
import { logger } from '../../services/logger.service.js'

export const shziraService = {
    query,
    add,
}

async function query(filterBy = { User: 'Admin' }) {
    const { User, from, to, type, groupBy } = filterBy
    try {
        const criteria = {}
        
        // User filter
        if (User && User !== 'all') criteria.User = User
        
        // Date range filter
        if (from || to) {
            criteria.Date = {}
            if (from) criteria.Date.$gte = new Date(from)
            if (to) criteria.Date.$lte = new Date(to)
        }
        
        // Type filter
        if (type && type !== 'all') criteria.type = type
        
        const collection = await dbService.getCollection('Production_Shezira')
        
        // If groupBy is specified, use aggregation
        if (groupBy) {
            return await getAggregatedData(collection, criteria, groupBy)
        }
        
        let shziraOptions = await collection.find(criteria).limit(200).toArray()
        return shziraOptions
    } catch (err) {
        logger.error('cannot find shzira options', err)
        throw err
    }
}

async function getAggregatedData(collection, criteria, groupBy) {
    try {
        let pipeline = [{ $match: criteria }]
        
        switch (groupBy) {
            case 'daily':
                pipeline.push(
                    {
                        $group: {
                            _id: {
                                year: { $year: "$Date" },
                                month: { $month: "$Date" },
                                day: { $dayOfMonth: "$Date" }
                            },
                            totalSets: { $sum: "$sets" },
                            totalRuns: { $sum: "$shezira_runs" },
                            date: { $first: "$Date" }
                        }
                    },
                    {
                        $sort: { "date": 1 }
                    },
                    {
                        $project: {
                            date: "$date",
                            totalSets: 1,
                            totalRuns: 1,
                            _id: 0
                        }
                    }
                )
                break
                
            case 'type':
                pipeline.push(
                    {
                        $group: {
                            _id: "$type",
                            totalSets: { $sum: "$sets" },
                            totalRuns: { $sum: "$shezira_runs" },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $sort: { "totalSets": -1 }
                    },
                    {
                        $project: {
                            type: "$_id",
                            totalSets: 1,
                            totalRuns: 1,
                            count: 1,
                            _id: 0
                        }
                    }
                )
                break
                
            case 'monthly':
                pipeline.push(
                    {
                        $group: {
                            _id: {
                                year: { $year: "$Date" },
                                month: { $month: "$Date" }
                            },
                            totalSets: { $sum: "$sets" },
                            totalRuns: { $sum: "$shezira_runs" },
                            date: { $first: "$Date" }
                        }
                    },
                    {
                        $sort: { "_id.year": 1, "_id.month": 1 }
                    },
                    {
                        $project: {
                            month: "$_id.month",
                            year: "$_id.year",
                            totalSets: 1,
                            totalRuns: 1,
                            _id: 0
                        }
                    }
                )
                break
        }
        
        return await collection.aggregate(pipeline).toArray()
    } catch (err) {
        logger.error('cannot aggregate shzira data', err)
        throw err
    }
}

async function add(eventToAdd) {
    try {
        const collection = await dbService.getCollection('Production_Shezira')
        await collection.insertOne(eventToAdd)
        return eventToAdd
    } catch (err) {
        logger.error('cannot insert shzira event', err)
        throw err
    }
}