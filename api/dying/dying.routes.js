import express from 'express'
import { addDyingEvent, getDyingInfo, getAvailableSetTypes } from './dying.controller.js'

export const dyingRoutes = express.Router()

dyingRoutes.get('/set-types', getAvailableSetTypes)
dyingRoutes.get('/', getDyingInfo)
dyingRoutes.post('/', addDyingEvent)