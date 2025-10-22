import { permissionsService } from './permissions.service.js'
import { logger } from '../../services/logger.service.js'

export async function getUserPermissions(req, res) {
    try {
        const { username } = req.params
        const permissions = await permissionsService.getUserPermissions(username)
        res.json(permissions)
    } catch (err) {
        logger.error('Failed to get user permissions', err)
        res.status(500).json({ err: 'Failed to get user permissions' })
    }
}

export async function createUserPermissions(req, res) {
    try {
        const { username, permissions } = req.body
        
        if (!username) {
            return res.status(400).json({ err: 'Username is required' })
        }
        
        const userPermissions = await permissionsService.createUserPermissions(username, permissions)
        res.json(userPermissions)
    } catch (err) {
        logger.error('Failed to create user permissions', err)
        if (err.message === 'User permissions already exist') {
            return res.status(409).json({ err: err.message })
        }
        res.status(500).json({ err: 'Failed to create user permissions' })
    }
}

export async function updateUserPermissions(req, res) {
    try {
        const { username } = req.params
        const { permissions } = req.body
        
        if (!permissions) {
            return res.status(400).json({ err: 'Permissions are required' })
        }
        
        const updatedPermissions = await permissionsService.updateUserPermissions(username, permissions)
        res.json(updatedPermissions)
    } catch (err) {
        logger.error('Failed to update user permissions', err)
        if (err.message === 'User permissions not found') {
            return res.status(404).json({ err: err.message })
        }
        res.status(500).json({ err: 'Failed to update user permissions' })
    }
}

export async function getAllUserPermissions(req, res) {
    try {
        const allPermissions = await permissionsService.getAllUserPermissions()
        res.json(allPermissions)
    } catch (err) {
        logger.error('Failed to get all user permissions', err)
        res.status(500).json({ err: 'Failed to get all user permissions' })
    }
}

export async function deleteUserPermissions(req, res) {
    try {
        const { username } = req.params
        const result = await permissionsService.deleteUserPermissions(username)
        res.json(result)
    } catch (err) {
        logger.error('Failed to delete user permissions', err)
        if (err.message === 'User permissions not found') {
            return res.status(404).json({ err: err.message })
        }
        res.status(500).json({ err: 'Failed to delete user permissions' })
    }
}

export async function getDefaultPermissions(req, res) {
    try {
        const defaultPermissions = permissionsService.getDefaultPermissions()
        res.json(defaultPermissions)
    } catch (err) {
        logger.error('Failed to get default permissions', err)
        res.status(500).json({ err: 'Failed to get default permissions' })
    }
}
