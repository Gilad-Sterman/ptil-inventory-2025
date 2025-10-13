import mongodb from 'mongodb'
const { ObjectId } = mongodb

import { dbService } from '../../services/db.service.js'

export const logService = {
    addNewLog,
    addNewIcountLog,
    getSetProductionDailyStats,
    getSetProductionTypeStats,
    getSetProductionMonthlyTotal,
    // deleteMany
}

async function addNewLog({ type, userName, amount, description, products, SKUs }) {
    try {
        const logToAdd = {
            date: new Date,
            type,
            userName: userName || 'no-user',
            description,
            SKUs,
            amount,
        }
        if (products) logToAdd.products = products
        const collection = await dbService.getCollection('logs')
        await collection.insertOne(logToAdd)
        return logToAdd
    } catch (err) {
        logger.error('cannot insert log', err)
        throw err
    }
}

async function addNewIcountLog({ quantity, products, SKUs }) {
    try {
        const logToAdd = {
            date: new Date,
            type: 'New From Icount',
            products, 
            SKUs,
            quantity,
        }
        const collection = await dbService.getCollection('logs')
        await collection.insertOne(logToAdd)
        return logToAdd
    } catch (err) {
        logger.error('cannot insert log', err)
        throw err
    }
}

// Get daily set production stats from "Added Inventory" logs
async function getSetProductionDailyStats({ from, to, groupBy }) {
    try {
        const collection = await dbService.getCollection('logs')
        const fromDate = new Date(from)
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999) // Include the entire end date

        const pipeline = [
            {
                $match: {
                    type: "Added Inventory",
                    date: { $gte: fromDate, $lte: toDate }
                }
            },
            {
                $unwind: "$products"
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$date" }
                    },
                    totalSets: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: "$_id",
                    totalSets: 1,
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]

        const result = await collection.aggregate(pipeline).toArray()
        return result
    } catch (err) {
        console.error('cannot get daily set production stats', err)
        throw err
    }
}

// Get set production stats by product type from "Added Inventory" logs
async function getSetProductionTypeStats({ from, to, groupBy }) {
    try {
        const collection = await dbService.getCollection('logs')
        const fromDate = new Date(from)
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)

        const pipeline = [
            {
                $match: {
                    type: "Added Inventory",
                    date: { $gte: fromDate, $lte: toDate }
                }
            },
            {
                $unwind: "$products"
            },
            {
                $group: {
                    _id: "$products.Description-Heb",
                    totalSets: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    type: "$_id",
                    totalSets: 1,
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { totalSets: -1 } }
        ]

        const result = await collection.aggregate(pipeline).toArray()
        return result
    } catch (err) {
        console.error('cannot get set production type stats', err)
        throw err
    }
}

// Get monthly total set production from "Added Inventory" logs
async function getSetProductionMonthlyTotal({ from, to, groupBy }) {
    try {
        const collection = await dbService.getCollection('logs')
        const fromDate = new Date(from)
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)

        const pipeline = [
            {
                $match: {
                    type: "Added Inventory",
                    date: { $gte: fromDate, $lte: toDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSets: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]

        const result = await collection.aggregate(pipeline).toArray()
        return result.length > 0 ? result[0].totalSets : 0
    } catch (err) {
        console.error('cannot get monthly set production total', err)
        throw err
    }
}

async function deleteMany(){
    try {
        const collection = await dbService.getCollection('logs')
        await collection.deleteMany({description: "Updated 10000000001 - Inventory: 23 - Location: A-120"})
    } catch (err) {
        logger.error('cannot delete logs', err)
        throw err
    }
}