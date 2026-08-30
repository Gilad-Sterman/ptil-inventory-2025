import mongodb from 'mongodb'
const { ObjectId } = mongodb

import { dbService } from '../../services/db.service.js'
import { logger } from '../../services/logger.service.js'
import { BEGGED, STRING, TYING, COLOR, isTalitGadol } from '../../services/info.service.js'


async function query(filterBy = { txt: '' }) {
    const { from, to, txt, sortBy, sortDir, maxNum, categories, moreCategories, specificCodes } = filterBy
    try {
        let criteria = {
            $and: [{ LastUpdate: { $gt: from, $lt: to } }],
        }
        if (txt) {
            criteria['$and'].push({
                '$or': [
                    { 'Description-Heb': { $regex: txt.trim(), $options: 'i' } },
                    { 'Description-Eng': { $regex: txt.trim(), $options: 'i' } },
                    { SKU: { $regex: txt.trim(), $options: 'i' } }
                ]
            })
        }
        if (maxNum) criteria['$and'].push({ $expr: { $lt: ['$Inventory', '$MinimumLevel'] } })
        if (categories) {
            const categoriesArr = categories.map(category => {
                if (category === 'other') return { SKU: { $regex: new RegExp('^100.{2}0000.{2}') } }
                if (category === 'strings') return {
                    '$and': [
                        { SKU: { $regex: new RegExp('0000$') } },
                        { SKU: { $regex: new RegExp('^10000') } }
                    ]
                }
                if (category === 'begaddim') {
                    if (!moreCategories || moreCategories.length > 1) {
                        return {
                            '$and': [
                                { 'SKU': { '$not': { '$regex': new RegExp('^10000') } } }, // Not strings
                                { 'SKU': { '$not': { '$regex': new RegExp('^100[0-9]{2}') } } }, // Not other products
                                { 'SKU': { '$not': { '$regex': new RegExp('0000$') } } }, // Not pure strings
                                { 'SKU': { '$regex': new RegExp('^1[0-9]{2}[0-9]{2}') } } // Starts with 1 + begged code + size
                            ]
                        }
                    }
                    if (moreCategories.includes('untied')) {
                        return {
                            '$or': [
                                { 'SKU': { '$regex': new RegExp('^1[0-9]{2}[0-9]{2}000000$') } }, // Old untied: ends with 000000
                                { 'SKU': { '$regex': new RegExp('^1[0-9]{2}[0-9]{2}0000[5-6][0-9]$') } } // New TG untied: ends with 0000 + color
                            ]
                        }
                    }
                    return {
                        '$and': [
                            { 'SKU': { '$not': { '$regex': new RegExp('^10000') } } }, // Not strings
                            { 'SKU': { '$not': { '$regex': new RegExp('^100[0-9]{2}') } } }, // Not other products
                            { 'SKU': { '$not': { '$regex': new RegExp('0000$') } } }, // Not pure strings
                            { 'SKU': { '$regex': new RegExp('^1[0-9]{2}[0-9]{2}') } }, // Starts with 1 + begged code + size
                            { 'SKU': { '$not': { '$regex': new RegExp('^1[0-9]{2}[0-9]{2}000000$') } } }, // Not old untied
                            { 'SKU': { '$not': { '$regex': new RegExp('^1[0-9]{2}[0-9]{2}0000[5-6][0-9]$') } } } // Not new TG untied
                        ]
                    }
                }
            })
            criteria['$and'].push({ $or: categoriesArr })
        }

        if (specificCodes && categories) {
            if (specificCodes.begged && categories.includes('begaddim')) {
                const codesArr = specificCodes.begged.map(begged => {
                    // Ensure begged code is padded to 2 digits
                    const paddedCode = begged.toString().padStart(2, '0')
                    return { SKU: { $regex: new RegExp(`^1${paddedCode}`) } }
                })
                criteria['$and'].push({ $or: codesArr })
            }

            if (specificCodes.size && (categories.includes('begaddim') || categories.includes('other'))) {
                const codesArr = specificCodes.size.map(size => {
                    return { SKU: { $regex: new RegExp(`^.{3}${size}.{6}$`) } }
                })
                criteria['$and'].push({ $or: codesArr })
            }

            if (specificCodes.strings && moreCategories?.includes('tied')) {
                const codesArr = specificCodes.strings.map(string => {
                    return { SKU: { $regex: new RegExp(`^.{5}${string}.{2}.{2}$`) } }
                })
                // console.log(codesArr);
                criteria['$and'].push({ $or: codesArr })
            }

            if (specificCodes.tying && moreCategories?.includes('tied')) {
                const codesArr = specificCodes.tying.map(tie => {
                    return { SKU: { $regex: new RegExp(`^.{7}${tie}.{2}$`) } }
                })
                // console.log(codesArr);
                criteria['$and'].push({ $or: codesArr })
            }
        }
        if (!from && !to) {
            criteria = {
                '$or': [
                    { 'Description-Heb': { $regex: txt.trim(), $options: 'i' } },
                    { 'Description-Eng': { $regex: txt.trim(), $options: 'i' } },
                    { SKU: { $regex: txt.trim(), $options: 'i' } }
                ]
            }
        }
        const collection = await dbService.getCollection('inventory')
        let orders = await collection.find(criteria).sort({ [sortBy]: (sortDir === 'down') ? 1 : -1 }).limit(200).toArray()
        return orders
    } catch (err) {
        logger.error('cannot find orders', err)
        throw err
    }
}

async function getByType(type) {
    try {
        const criteria = {}
        if (type === 'strings') {
            criteria['$and'] = [
                { SKU: { $regex: new RegExp('0000$') } },
                { SKU: { $regex: new RegExp('^10000') } }
            ]
        }
        if (type === 'other') {
            criteria.SKU = { $regex: new RegExp('^100.{2}0000.{2}') }
        }
        if (type === 'begged') {
            // Look for products that have begged codes but are not strings (don't start with 10000)
            // and are not pure "other" products (don't start with 100XX where XX is size)
            criteria['$and'] = [
                { SKU: { $regex: new RegExp('^1[0-9]{2}[0-9]{2}') } }, // Starts with 1 + begged + size
                { SKU: { $not: { $regex: new RegExp('^10000') } } }, // Not strings
                { SKU: { $not: { $regex: new RegExp('^100[0-9]{2}0000') } } } // Not pure other products
            ]
        }
        const collection = await dbService.getCollection('inventory')
        let products = await collection.find(criteria).toArray()
        return products
    } catch (err) {
        logger.error('cannot find products', err)
        throw err
    }
}

async function getSizes(type, code) {
    try {
        const criteria = {}
        if (type === 'other') {
            criteria.SKU = { $regex: new RegExp(`^100.{2}0000${code}`) }
        }
        if (type === 'begged') {
            // Find products that start with 1 + begged code + any size, regardless of strings/tying/color
            criteria.SKU = { $regex: new RegExp(`^1${code}[0-9]{2}`) }
        }
        const collection = await dbService.getCollection('inventory')
        let products = await collection.find(criteria).toArray()
        
        // Extract unique sizes from the products for begged type
        if (type === 'begged') {
            const uniqueSizes = [...new Set(products.map(product => product.SKU.substring(3, 5)))]
            // Convert back to product-like objects for consistency with frontend expectations
            return uniqueSizes.map(size => ({
                SKU: `1${code}${size}000000`, // Dummy SKU for size extraction
                'Description-Heb': `Size ${size}`,
                'Description-Eng': `Size ${size}`
            }))
        }
        
        return products
    } catch (err) {
        logger.error('cannot find products', err)
        throw err
    }
}

async function getColors(begged, size) {
    try {
        if (!isTalitGadol(begged) || !begged) {
            return []
        }
        
        if (size) {
            // Try inventory first — works for existing products that already have colored inventory
            const criteria = {
                SKU: { $regex: new RegExp(`^1${begged}${size}.{4}[5-6][0-9]$`) }
            }
            const collection = await dbService.getCollection('inventory')
            const products = await collection.find(criteria).toArray()
            const colorCodes = [...new Set(products.map(product => product.SKU.slice(-2)))]
            if (colorCodes.length > 0) return colorCodes
        }
        
        // Fallback to MongoDataCodes — works for new products with no inventory yet,
        // and also when no size is provided yet
        const colorObjects = await getColorsForBegged(begged, size || null)
        return colorObjects.map(c => c.code)
    } catch (err) {
        logger.error('cannot find colors', err)
        throw err
    }
}

async function getById(orderId) {
    try {
        const collection = await dbService.getCollection('order')
        const order = collection.findOne({ _id: ObjectId(orderId) })
        return order
    } catch (err) {
        logger.error(`while finding order ${orderId}`, err)
        throw err
    }
}

async function getBySKU(productSKU) {
    try {
        const collection = await dbService.getCollection('inventory')
        const product = await collection.findOne({ SKU: productSKU })
        // console.log('product:', product);
        return product
    } catch (err) {
        logger.error(`while finding product ${productSKU}`, err)
        throw err
    }
}

async function updateInventory(product, increment) {
    try {
        const productToSave = {
            SKU: product.SKU,
            'Description-Heb': product['Description-Heb'],
            'Description-Eng': product['Description-Eng'],
            'Inventory': product['Inventory'] + increment,
            'Cost': product['Cost'],
            'Price': product['Price'],
            'USDPrice': product['USDPrice'],
            'MinimumLevel': product['MinimumLevel'],
            LastUpdate: new Date,
        }
        const collection = await dbService.getCollection('inventory')
        await collection.updateOne({ _id: ObjectId(product._id) }, { $set: productToSave })
        return productToSave
    } catch (err) {
        logger.error(`cannot update product ${product._id}`, err)
        throw err
    }
}

async function setInventory(product) {
    const { SKU, Inventory, Location } = product
    try {
        const collection = await dbService.getCollection('inventory')
        await collection.updateOne({ SKU }, { $set: { Inventory, LastUpdate: new Date, Location } })
        return product
    } catch (err) {
        logger.error(`cannot update product ${SKU}`, err)
        throw err
    }
}

async function add(productSKU, amount) {
    const beggedCode = productSKU.substring(1, 3)
    console.log(`DEBUG add: SKU=${productSKU}, beggedCode=${beggedCode}`)
    
    const beggedItem = BEGGED.find(begged => begged.code === beggedCode)
    const stringCode = productSKU.substring(5, 7)
    const tyingCode = productSKU.substring(7, 9)
    const stringItem = STRING.find(string => string.code === stringCode)
    const tyingItem = TYING.find(tying => tying.code === tyingCode)
    
    console.log(`DEBUG add: beggedItem found=${!!beggedItem}, stringItem found=${!!stringItem}, tyingItem found=${!!tyingItem}`)
    
    if (!beggedItem) {
        throw new Error(`Begged code ${beggedCode} not found in BEGGED array`)
    }
    if (!stringItem) {
        throw new Error(`String code ${stringCode} not found in STRING array`)
    }
    if (!tyingItem) {
        throw new Error(`Tying code ${tyingCode} not found in TYING array`)
    }
    
    const beggedHeb = beggedItem.heb
    const beggedEng = beggedItem.eng
    const sizeCode = productSKU.substring(3, 5)
    const stringHeb = stringItem.heb
    const stringEng = stringItem.eng
    const tyingHeb = tyingItem.heb
    const tyingEng = tyingItem.eng
    
    // Handle color for TG products only
    const colorCode = productSKU.substring(9, 11)
    const isBaseProduct = stringCode === '00' && tyingCode === '00'
    let colorHeb = '', colorEng = ''
    
    if (isTalitGadol(beggedCode) && colorCode !== '00') {
        const colorInfo = COLOR.find(color => color.code === colorCode)
        if (colorInfo) {
            colorHeb = ` - ${colorInfo.heb}`
            colorEng = ` - ${colorInfo.eng}`
        }
    }

    try {
        let descriptionHeb, descriptionEng
        
        if (isBaseProduct) {
            // Base products: just begged + color + size
            descriptionHeb = `${beggedHeb}${colorHeb}: ${sizeCode}`
            descriptionEng = `${beggedEng}${colorEng}: ${sizeCode}`
        } else {
            // Full products: include strings and tying
            descriptionHeb = `${beggedHeb}${colorHeb}: ${sizeCode} : ${stringHeb} : ${tyingHeb}`
            descriptionEng = `${beggedEng}${colorEng}: ${sizeCode} : ${stringEng} : ${tyingEng}`
        }
        
        const productToAdd = {
            SKU: productSKU,
            'Description-Heb': descriptionHeb,
            'Description-Eng': descriptionEng,
            'Inventory': amount,
            'Cost': -0.1,
            'Price': -0.1,
            'USDPrice': -0.1,
            'MinimumLevel': 5,
            LastUpdate: new Date,
        }
        const collection = await dbService.getCollection('inventory')
        await collection.insertOne(productToAdd)
        return productToAdd
    } catch (err) {
        logger.error('cannot insert product', err)
        throw err
    }
}

async function addNewProduct(Cost, DescriptionEng, DescriptionHeb, Inventory, Price, SKU, USDPrice, Location, MinimumLevel) {
    try {
        const productToAdd = {
            SKU,
            'Description-Heb': DescriptionHeb,
            'Description-Eng': DescriptionEng,
            Inventory: +Inventory,
            Cost: +Cost,
            Price: +Price,
            USDPrice: +USDPrice,
            MinimumLevel: +MinimumLevel,
            Location,
            LastUpdate: new Date,
        }
        const collection = await dbService.getCollection('inventory')
        await collection.insertOne(productToAdd)
        return productToAdd
    } catch (err) {
        logger.error('cannot insert product', err)
        throw err
    }
}

async function newOrderFromIcount(item) {
    try {
        item.data = await getData(item.sku)
        const collection = await dbService.getCollection('orders')
        await collection.insertOne(item)
        return item
    } catch (err) {
        logger.error('cannot insert new order', err)
        throw err
    }
}

async function getData(sku) {
    try {
        const data = {
            beged: { code: -1, name: '' },
            size: { code: -1, name: '' },
            ptil: { code: -1, name: '' },
            tying: { code: -1, name: '' },
            color: { code: -1, name: '' }
        }
        if (sku) {
            const collection = await dbService.getCollection('MongoDataCodes')
            const bName = await collection.findOne({ '$and': [{ Type: 'beged' }, { Code: parseInt(sku.substring(1, 3)) }] })
            const pName = await collection.findOne({ '$and': [{ Type: 'ptil' }, { Code: parseInt(sku.substring(5, 7)) }] })
            const tName = await collection.findOne({ '$and': [{ Type: 'tying' }, { Code: parseInt(sku.substring(7, 9)) }] })
            
            // Handle color for TG products only
            const beggedCode = sku.substring(1, 3)
            let cName = null
            if (isTalitGadol(beggedCode)) {
                const colorCode = parseInt(sku.substring(9, 11))
                console.log(`DEBUG getData: TG product detected. SKU: ${sku}, beggedCode: ${beggedCode}, colorCode: ${colorCode}`)
                
                if (colorCode >= 50 && colorCode <= 65) {
                    console.log(`DEBUG getData: Looking for color with Code: ${colorCode}`)
                    cName = await collection.findOne({ '$and': [{ Type: 'color' }, { Code: colorCode }] })
                    console.log(`DEBUG getData: Color lookup result:`, cName)
                } else {
                    console.log(`DEBUG getData: Color code ${colorCode} is outside valid range (50-62)`)
                }
            }

            data.beged.name = bName ? bName['item-Heb'] : 'Unknown'
            data.beged.code = parseInt(sku.substring(1, 3))
            data.size.code = parseInt(sku.substring(3, 5))
            data.size.name = parseInt(sku.substring(3, 5))
            data.ptil.name = pName ? pName['item-Heb'] : 'Unknown'
            data.ptil.code = parseInt(sku.substring(5, 7))
            data.tying.name = tName ? tName['item-Heb'] : 'Unknown'
            data.tying.code = parseInt(sku.substring(7, 9))
            
            if (cName) {
                console.log(`DEBUG getData: Setting color data from DB: ${cName['item-Heb']}`)
                data.color.name = cName['item-Heb']
                data.color.code = parseInt(sku.substring(9, 11))
            } else if (isTalitGadol(beggedCode)) {
                console.log(`DEBUG getData: WARNING - Color not found for TG product! SKU: ${sku}, colorCode: ${parseInt(sku.substring(9, 11))}`)
            }
        }

        return data
    } catch (err) {
        logger.error('cannot get item data', err)
        throw err
    }
}

async function getDyePowderInventory() {
    try {
        const dyePowder = await getBySKU('10000000030')
        return dyePowder ? dyePowder.Inventory : 0
    } catch (err) {
        logger.error('cannot get dye powder inventory', err)
        throw err
    }
}

async function getSalesByMonthAndStore(filterBy) {
    try {
        const { from, to, groupBy = 'monthly' } = filterBy
        const collection = await dbService.getCollection('orders')
        
        // Create match criteria for doctype filter and date range
        const matchCriteria = {
            doctype: { $in: ['invrec', 'invoice'] },
            date: {
                $gte: new Date(from),
                $lte: new Date(to)
            }
        }

        let groupStage
        let projectStage
        let sortStage

        if (groupBy === 'weekly') {
            // Group by week
            groupStage = {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        week: { $week: '$date' },
                        store: '$store'
                    },
                    totalRevenue: { $sum: '$total' },
                    totalRevenueDollars: { 
                        $sum: {
                            $cond: [
                                { $eq: ['$totalDollars', -1] },
                                0,
                                '$totalDollars'
                            ]
                        }
                    },
                    orderCount: { $sum: 1 },
                    // Keep a sample date from this week to calculate week start
                    sampleDate: { $first: '$date' }
                }
            }
            
            projectStage = {
                $project: {
                    _id: 0,
                    year: '$_id.year',
                    week: '$_id.week',
                    store: '$_id.store',
                    totalRevenue: 1,
                    totalRevenueDollars: 1,
                    orderCount: 1,
                    sampleDate: 1
                }
            }
            
            sortStage = { $sort: { year: 1, week: 1, store: 1 } }
        } else {
            // Group by month (default)
            groupStage = {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        store: '$store'
                    },
                    totalRevenue: { $sum: '$total' },
                    totalRevenueDollars: { 
                        $sum: {
                            $cond: [
                                { $eq: ['$totalDollars', -1] },
                                0,
                                '$totalDollars'
                            ]
                        }
                    },
                    orderCount: { $sum: 1 }
                }
            }
            
            projectStage = {
                $project: {
                    _id: 0,
                    year: '$_id.year',
                    month: '$_id.month',
                    store: '$_id.store',
                    totalRevenue: 1,
                    totalRevenueDollars: 1,
                    orderCount: 1
                }
            }
            
            sortStage = { $sort: { year: 1, month: 1, store: 1 } }
        }

        const pipeline = [
            { $match: matchCriteria },
            groupStage,
            projectStage,
            sortStage
        ]

        const results = await collection.aggregate(pipeline).toArray()
        
        // If weekly grouping, calculate the Sunday date for each week
        if (groupBy === 'weekly') {
            return results.map(item => {
                // Calculate the Sunday of the week using the sample date
                const sampleDate = new Date(item.sampleDate)
                const dayOfWeek = sampleDate.getDay() // 0 = Sunday, 1 = Monday, etc.
                const daysToSubtract = dayOfWeek // Days to go back to Sunday
                
                const weekStart = new Date(sampleDate)
                weekStart.setDate(sampleDate.getDate() - daysToSubtract)
                
                return {
                    ...item,
                    weekStart: weekStart
                }
            })
        }
        
        return results
    } catch (err) {
        logger.error('cannot get sales by month and store', err)
        throw err
    }
}

async function getSetsSalesByMonthAndStore(filterBy) {
    try {
        const { from, to, groupBy = 'monthly' } = filterBy
        const collection = await dbService.getCollection('orders')
        
        // Create match criteria for doctype filter, date range, and valid ptil
        const matchCriteria = {
            doctype: { $in: ['invrec', 'invoice'] },
            date: {
                $gte: new Date(from),
                $lte: new Date(to)
            },
            // Filter for orders with valid ptil data
            'data.ptil.code': { $gt: 0 }
        }

        let groupStage
        let projectStage
        let sortStage

        if (groupBy === 'weekly') {
            // Group by week
            groupStage = {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        week: { $week: '$date' },
                        store: '$store'
                    },
                    totalRevenue: { $sum: '$total' },
                    totalRevenueDollars: { 
                        $sum: {
                            $cond: [
                                { $eq: ['$totalDollars', -1] },
                                0,
                                '$totalDollars'
                            ]
                        }
                    },
                    orderCount: { $sum: 1 },
                    setsCount: { $sum: '$quantity' },
                    // Keep a sample date from this week to calculate week start
                    sampleDate: { $first: '$date' }
                }
            }
            
            projectStage = {
                $project: {
                    _id: 0,
                    year: '$_id.year',
                    week: '$_id.week',
                    store: '$_id.store',
                    totalRevenue: 1,
                    totalRevenueDollars: 1,
                    orderCount: 1,
                    setsCount: 1,
                    sampleDate: 1
                }
            }
            
            sortStage = { $sort: { year: 1, week: 1, store: 1 } }
        } else {
            // Group by month (default)
            groupStage = {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        store: '$store'
                    },
                    totalRevenue: { $sum: '$total' },
                    totalRevenueDollars: { 
                        $sum: {
                            $cond: [
                                { $eq: ['$totalDollars', -1] },
                                0,
                                '$totalDollars'
                            ]
                        }
                    },
                    orderCount: { $sum: 1 },
                    setsCount: { $sum: '$quantity' }
                }
            }
            
            projectStage = {
                $project: {
                    _id: 0,
                    year: '$_id.year',
                    month: '$_id.month',
                    store: '$_id.store',
                    totalRevenue: 1,
                    totalRevenueDollars: 1,
                    orderCount: 1,
                    setsCount: 1
                }
            }
            
            sortStage = { $sort: { year: 1, month: 1, store: 1 } }
        }

        const pipeline = [
            { $match: matchCriteria },
            groupStage,
            projectStage,
            sortStage
        ]

        const results = await collection.aggregate(pipeline).toArray()
        
        // If weekly grouping, calculate the Sunday date for each week
        if (groupBy === 'weekly') {
            return results.map(item => {
                // Calculate the Sunday of the week using the sample date
                const sampleDate = new Date(item.sampleDate)
                const dayOfWeek = sampleDate.getDay() // 0 = Sunday, 1 = Monday, etc.
                const daysToSubtract = dayOfWeek // Days to go back to Sunday
                
                const weekStart = new Date(sampleDate)
                weekStart.setDate(sampleDate.getDate() - daysToSubtract)
                
                return {
                    ...item,
                    weekStart: weekStart
                }
            })
        }
        
        return results
    } catch (err) {
        logger.error('cannot get sets sales by month and store', err)
        throw err
    }
}

export const orderService = {
    query,
    getById,
    getBySKU,
    getByType,
    getSizes,
    getColors,
    updateInventory,
    setInventory,
    add,
    newOrderFromIcount,
    addNewProduct,
    getDyePowderInventory,
    getSalesByMonthAndStore,
    getSetsSalesByMonthAndStore,
    getBeggedFromDataCodes,
    getColorsForBegged,
    getSizesForBegged,
    getSizesForBeggedAndColor,
    createProductFromSKU
}

async function getBeggedFromDataCodes() {
    try {
        const collection = await dbService.getCollection('MongoDataCodes')
        
        // Get ALL begged entries, not just TG
        const allBeggedEntries = await collection.find({ Type: 'beged' }).toArray()
        
        // Format for frontend consumption - include ALL begged types
        // Filter out entries with empty item-Heb field
        const formattedBegged = allBeggedEntries
            .filter(entry => entry['item-Heb'] && entry['item-Heb'].trim() !== '')
            .map(entry => ({
                code: entry.Code.toString().padStart(2, '0'), // Ensure 2-digit format
                heb: entry['item-Heb'],
                eng: entry['Item-Eng'] || entry['item-Eng'], // Handle both field name variations
                isTG: entry.isTG || false, // Will be true for TG products once you add the field
                availableColors: entry.availableColors || []
            }))
        return formattedBegged
    } catch (err) {
        logger.error('cannot get begged from MongoDataCodes', err)
        throw err
    }
}

async function getColorsForBegged(beggedCode, sizeCode = null) {
    try {
        const collection = await dbService.getCollection('MongoDataCodes')
        
        // First get the begged entry to find available colors
        const beggedEntry = await collection.findOne({ 
            Type: 'beged', 
            Code: parseInt(beggedCode),
            isTG: true
        })
        
        if (!beggedEntry || !beggedEntry.availableColors) {
            return []
        }
        
        let availableColorCodes = beggedEntry.availableColors
        
        // If size is provided and colorSizeMatrix exists, filter colors by size
        if (sizeCode && beggedEntry.colorSizeMatrix) {
            availableColorCodes = []
            for (const [colorCode, sizes] of Object.entries(beggedEntry.colorSizeMatrix)) {
                if (sizes.includes(sizeCode)) {
                    availableColorCodes.push(colorCode)
                }
            }
        }
        
        if (availableColorCodes.length === 0) {
            return []
        }
        
        // Get color details for available color codes
        // Convert string codes to numbers for the query
        const colorCodesAsNumbers = availableColorCodes.map(code => parseInt(code))
        
        const colorEntries = await collection.find({
            Type: 'color',
            Code: { $in: colorCodesAsNumbers }
        }).toArray()
        
        // Format for frontend consumption
        const formattedColors = colorEntries.map(entry => ({
            code: entry.Code.toString().padStart(2, '0'), // Ensure 2-digit format
            heb: entry['item-Heb'],
            eng: entry['Item-Eng'] || entry['item-Eng']
        }))
        return formattedColors
    } catch (err) {
        logger.error('cannot get colors for begged from MongoDataCodes', err)
        throw err
    }
}

async function getSizesForBegged(beggedCode) {
    try {
        const collection = await dbService.getCollection('MongoDataCodes')
        
        // Get the begged entry to check if it has predefined sizes
        const beggedEntry = await collection.findOne({ 
            Type: 'beged', 
            Code: parseInt(beggedCode)
        })
        
        if (beggedEntry && beggedEntry.availableSizes) {
            // Use predefined sizes from MongoDataCodes
            return beggedEntry.availableSizes.map(size => size.toString().padStart(2, '0'))
        }
        
        // Fallback: Use hardcoded size arrays based on product type
        const TG_CODES = [7, 14, 15, 16, 17, 18, 19, 20]
        const TK_CODES = [50, 51, 52, 53, 54, 55, 56, 57, 58, 60, 99]
        
        if (TG_CODES.includes(parseInt(beggedCode))) {
            return ['45', '50', '55', '60', '70', '80']
        } else if (TK_CODES.includes(parseInt(beggedCode))) {
            return ['16', '18', '22', '24', '26']
        } else {
            return ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09']
        }
    } catch (err) {
        logger.error('cannot get sizes for begged from MongoDataCodes', err)
        throw err
    }
}

async function getSizesForBeggedAndColor(beggedCode, colorCode) {
    try {
        const collection = await dbService.getCollection('MongoDataCodes')
        
        // Get the begged entry to check if it has colorSizeMatrix
        const beggedEntry = await collection.findOne({ 
            Type: 'beged', 
            Code: parseInt(beggedCode)
        })
        
        if (beggedEntry && beggedEntry.colorSizeMatrix && beggedEntry.colorSizeMatrix[colorCode]) {
            // Use sizes from colorSizeMatrix for this specific color
            return beggedEntry.colorSizeMatrix[colorCode].map(size => size.toString().padStart(2, '0'))
        }
        
        // Fallback to regular getSizesForBegged if no colorSizeMatrix
        return await getSizesForBegged(beggedCode)
        
    } catch (err) {
        logger.error('cannot get sizes for begged and color from MongoDataCodes', err)
        throw err
    }
}

async function createProductFromSKU(productSKU, initialAmount = 0) {
    try {
        const { COLOR, isTalitGadol } = await import('../../services/info.service.js')
        
        // Parse SKU: format is like 11880000056 (1-18-80-0000-56)
        if (productSKU.length !== 11) {
            throw new Error(`Invalid SKU format: ${productSKU}`)
        }
        
        const productType = productSKU.charAt(0) // 1 = begged
        const productCode = productSKU.substring(1, 3) // 18 = Lamenatzeach
        const sizeCode = productSKU.substring(3, 5) // 80 = size
        const stringCode = productSKU.substring(5, 7) // 00 = no strings
        const tyingCode = productSKU.substring(7, 9) // 00 = no tying
        const colorCode = productSKU.substring(9, 11) // 56 = Jeans
        
        if (productType !== '1') {
            throw new Error(`Only begged products (type 1) can be auto-created from SKU`)
        }
        
        // Get product details from MongoDataCodes
        const collection = await dbService.getCollection('MongoDataCodes')
        
        const beggedEntry = await collection.findOne({ 
            Type: 'beged', 
            Code: parseInt(productCode)
        })
        
        if (!beggedEntry) {
            throw new Error(`Product code ${productCode} not found in MongoDataCodes`)
        }
        
        // Get color details
        const colorEntry = await collection.findOne({
            Type: 'color',
            Code: parseInt(colorCode)
        })
        
        if (!colorEntry) {
            throw new Error(`Color code ${colorCode} not found in MongoDataCodes`)
        }
        
        // Generate product description
        const baseHeb = beggedEntry['item-Heb']
        const baseEng = beggedEntry['Item-Eng']
        const colorHeb = colorEntry['item-Heb']
        const colorEng = colorEntry['Item-Eng'] || colorEntry['item-Eng']
        
        const descriptionHeb = isTalitGadol(productCode) ? `${baseHeb} - ${colorHeb}: ${sizeCode}` : baseHeb
        const descriptionEng = isTalitGadol(productCode) ? `${baseEng} - ${colorEng}: ${sizeCode}` : baseEng
        
        // Create new product object
        const newProduct = {
            SKU: productSKU,
            'Description-Heb': descriptionHeb,
            'Description-Eng': descriptionEng,
            Cost: 0,
            Price: 0,
            USDPrice: 0,
            Inventory: initialAmount,
            MinimumLevel: 0,
            Location: '',
            SortOrder: 0,
            LastUpdate: new Date()
        }
        
        // Insert into database
        const inventoryCollection = await dbService.getCollection('inventory')
        const result = await inventoryCollection.insertOne(newProduct)
        
        // Return the created product with _id
        return { ...newProduct, _id: result.insertedId }
        
    } catch (err) {
        logger.error('cannot create product from SKU', err)
        throw err
    }
}