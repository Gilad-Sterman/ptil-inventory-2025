import mongodb from 'mongodb'
const { ObjectId } = mongodb

import { dbService } from '../../services/db.service.js'
import { logger } from '../../services/logger.service.js'
import { orderService } from '../order/order.service.js'

export const dyingService = {
    query,
    add,
    // getById,
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
        
        const collection = await dbService.getCollection('Production_Dyeing')
        
        // If groupBy is specified, use aggregation
        if (groupBy) {
            return await getDyingAggregatedData(collection, criteria, groupBy)
        }
        
        let dyeOptions = await collection.find(criteria).limit(200).toArray()
        return dyeOptions
    } catch (err) {
        logger.error('cannot find dye options', err)
        throw err
    }
}

async function getDyingAggregatedData(collection, criteria, groupBy) {
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
                            totalDye: { $sum: "$dye" },
                            totalDithionite: { $sum: "$dithionite" },
                            totalDolelot: { $sum: "$dolelot" },
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
                            totalDye: 1,
                            totalDithionite: 1,
                            totalDolelot: 1,
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
                            totalDye: { $sum: "$dye" },
                            totalDithionite: { $sum: "$dithionite" },
                            totalDolelot: { $sum: "$dolelot" },
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
                            totalDye: 1,
                            totalDithionite: 1,
                            totalDolelot: 1,
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
                            totalDye: { $sum: "$dye" },
                            totalDithionite: { $sum: "$dithionite" },
                            totalDolelot: { $sum: "$dolelot" },
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
                            totalDye: 1,
                            totalDithionite: 1,
                            totalDolelot: 1,
                            _id: 0
                        }
                    }
                )
                break
        }
        
        return await collection.aggregate(pipeline).toArray()
    } catch (err) {
        logger.error('cannot aggregate dying data', err)
        throw err
    }
}

async function add(eventToAdd) {
    try {
        const dye_Kg = eventToAdd.dye / 1000
        const collection = await dbService.getCollection('Production_Dyeing')
        await collection.insertOne(eventToAdd)
        const updatedDyePowder = await decrementDyePowder(dye_Kg)
        return { event: eventToAdd, dyePowder: updatedDyePowder }
    } catch (err) {
        logger.error('cannot insert dying event', err)
        throw err
    }
}

async function decrementDyePowder(dye_Kg) {
    try {
        const dyePowderProduct = await orderService.getBySKU('10000000030')
        const updatedProduct = await orderService.updateInventory(dyePowderProduct, -dye_Kg)
        return updatedProduct.Inventory
    } catch (err) {
        logger.error('cannot decrement dye powder', err)
        throw err
    }

}