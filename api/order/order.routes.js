import express from 'express'
import { requireAuth, requireAdmin } from '../../middlewares/requireAuth.middleware.js'
import { getOrders, getOrderById, getproductsByType, getproductSizes, getproductColors, updateInventory, updateInventoryBySKU, addNewProduct, updateBulkInventory, icountInfo, getSetProductionDailyStats, getSetProductionTypeStats, getSetProductionMonthlyTotal, getDyePowderInventory, getSalesByMonthAndStore, getSetsSalesByMonthAndStore, getBeggedFromDataCodes, getColorsForBegged, getSizesForBegged, getSizesForBeggedAndColor } from './order.controller.js'

export const orderRoutes = express.Router()

orderRoutes.get('/', getOrders)
// orderRoutes.get('/:id', getOrderById)
orderRoutes.get('/size', getproductSizes)
orderRoutes.get('/colors', getproductColors)
orderRoutes.get('/:type', getproductsByType)
orderRoutes.put('/', updateInventory)
orderRoutes.put('/bulk', updateBulkInventory)
orderRoutes.put('/:SKU', updateInventoryBySKU)
orderRoutes.post('/new', addNewProduct)
orderRoutes.post('/icount', icountInfo)

// Set production stats routes
orderRoutes.get('/logs/production/daily', getSetProductionDailyStats)
orderRoutes.get('/logs/production/type', getSetProductionTypeStats)
orderRoutes.get('/logs/production/total', getSetProductionMonthlyTotal)

// Dye powder inventory route
orderRoutes.get('/dye-powder/inventory', getDyePowderInventory)

// Sales analytics routes
orderRoutes.get('/sales/by-month-store', getSalesByMonthAndStore)
orderRoutes.get('/sets/by-month-store', getSetsSalesByMonthAndStore)

// MongoDataCodes routes
orderRoutes.get('/datacodes/begged', getBeggedFromDataCodes)
orderRoutes.get('/datacodes/colors', getColorsForBegged)
orderRoutes.get('/datacodes/sizes', getSizesForBegged)
orderRoutes.get('/datacodes/sizes-color', getSizesForBeggedAndColor)

