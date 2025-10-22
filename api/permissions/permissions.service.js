import { dbService } from '../../services/db.service.js'
import { logger } from '../../services/logger.service.js'
import mongodb from 'mongodb'

const { ObjectId } = mongodb

export const permissionsService = {
    getUserPermissions,
    createUserPermissions,
    updateUserPermissions,
    getAllUserPermissions,
    deleteUserPermissions,
    getDefaultPermissions
}

// Default permissions for new users
function getDefaultPermissions() {
    return {
        pages: ["home", "search", "dashboard"],
        roles: ["user"],
        features: {
            canViewStats: false,
            canAccessDying: false,
            canAccessShzira: false,
            canCreateProducts: true
        }
    }
}

// Admin permissions template
function getAdminPermissions() {
    return {
        pages: ["home", "search", "dashboard", "dying", "shzira", "stats", "new"],
        roles: ["admin", "user"],
        features: {
            canViewStats: true,
            canAccessDying: true,
            canAccessShzira: true,
            canCreateProducts: true
        }
    }
}

async function getUserPermissions(username) {
    try {
        const collection = await dbService.getCollection('permissions')
        let userPermissions = await collection.findOne({ username: username.toLowerCase() })
        
        // If user doesn't exist in permissions, create default permissions
        if (!userPermissions) {
            logger.info(`Creating default permissions for user: ${username}`)
            
            // Check if this is an admin user (backward compatibility)
            const isAdmin = username.toLowerCase() === 'admin' || username.toLowerCase() === 'mosheg'
            const permissions = isAdmin ? getAdminPermissions() : getDefaultPermissions()
            
            userPermissions = await createUserPermissions(username, permissions)
        }
        
        return userPermissions
    } catch (err) {
        logger.error(`Error getting permissions for user ${username}:`, err)
        throw err
    }
}

async function createUserPermissions(username, permissions = null) {
    try {
        const collection = await dbService.getCollection('permissions')
        
        // Check if user already exists
        const existingUser = await collection.findOne({ username: username.toLowerCase() })
        if (existingUser) {
            throw new Error('User permissions already exist')
        }
        
        const userPermissions = {
            username: username.toLowerCase(),
            permissions: permissions || getDefaultPermissions(),
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
        }
        
        const result = await collection.insertOne(userPermissions)
        userPermissions._id = result.insertedId
        
        logger.info(`Created permissions for user: ${username}`)
        return userPermissions
    } catch (err) {
        logger.error(`Error creating permissions for user ${username}:`, err)
        throw err
    }
}

async function updateUserPermissions(username, permissions) {
    try {
        const collection = await dbService.getCollection('permissions')
        
        const updateData = {
            permissions,
            updatedAt: new Date()
        }
        
        const result = await collection.updateOne(
            { username: username.toLowerCase() },
            { $set: updateData }
        )
        
        if (result.matchedCount === 0) {
            throw new Error('User permissions not found')
        }
        
        logger.info(`Updated permissions for user: ${username}`)
        return await getUserPermissions(username)
    } catch (err) {
        logger.error(`Error updating permissions for user ${username}:`, err)
        throw err
    }
}

async function getAllUserPermissions() {
    try {
        const collection = await dbService.getCollection('permissions')
        const allPermissions = await collection.find({ isActive: true }).toArray()
        return allPermissions
    } catch (err) {
        logger.error('Error getting all user permissions:', err)
        throw err
    }
}

async function deleteUserPermissions(username) {
    try {
        const collection = await dbService.getCollection('permissions')
        
        // Soft delete - mark as inactive
        const result = await collection.updateOne(
            { username: username.toLowerCase() },
            { 
                $set: { 
                    isActive: false,
                    updatedAt: new Date()
                }
            }
        )
        
        if (result.matchedCount === 0) {
            throw new Error('User permissions not found')
        }
        
        logger.info(`Deleted permissions for user: ${username}`)
        return { success: true }
    } catch (err) {
        logger.error(`Error deleting permissions for user ${username}:`, err)
        throw err
    }
}
