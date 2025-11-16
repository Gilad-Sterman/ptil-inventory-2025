import express from 'express'
import { requireAuth, requireAdmin } from '../../middlewares/requireAuth.middleware.js'
import { getOrders, getOrderById, getproductsByType, getproductSizes, updateInventory, updateInventoryBySKU, addNewProduct, updateBulkInventory, icountInfo, getSetProductionDailyStats, getSetProductionTypeStats, getSetProductionMonthlyTotal, getDyePowderInventory, getSalesByMonthAndStore, getSetsSalesByMonthAndStore } from './order.controller.js'

export const orderRoutes = express.Router()

orderRoutes.get('/', getOrders)
// orderRoutes.get('/:id', getOrderById)
orderRoutes.get('/size', getproductSizes)
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

