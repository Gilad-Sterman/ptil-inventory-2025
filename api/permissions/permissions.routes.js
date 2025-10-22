import express from 'express'
import { 
    getUserPermissions, 
    createUserPermissions, 
    updateUserPermissions, 
    getAllUserPermissions, 
    deleteUserPermissions,
    getDefaultPermissions
} from './permissions.controller.js'

const router = express.Router()

// Get all user permissions (for admin management)
router.get('/', getAllUserPermissions)

// Get default permissions template
router.get('/default', getDefaultPermissions)

// Get specific user permissions
router.get('/:username', getUserPermissions)

// Create new user permissions
router.post('/', createUserPermissions)

// Update user permissions
router.put('/:username', updateUserPermissions)

// Delete user permissions (soft delete)
router.delete('/:username', deleteUserPermissions)

export const permissionsRoutes = router
