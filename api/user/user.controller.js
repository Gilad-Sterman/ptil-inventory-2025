import { userService } from './user.service.js'
import { logger } from '../../services/logger.service.js'

export async function getUser(req, res) {
    try {
        const user = await userService.getById(req.params.id)
        logger.info(user);
        res.send(user)
    } catch (err) {
        logger.error('Failed to get user', err)
        res.status(500).send({ err: 'Failed to get user' })
    }
}

export async function getUsers(req, res) {
    try {
        const filterBy = {
            txt: req.query?.txt || '',
            likedByUser: req.query?.likedByUser || "all"
        }
        const users = await userService.query(filterBy)
        res.send(users)
    } catch (err) {
        logger.error('Failed to get users', err)
        res.status(500).send({ err: 'Failed to get users' })
    }
}

export async function deleteUser(req, res) {
    try {
        await userService.remove(req.params.id)
        res.send({ msg: 'Deleted successfully' })
    } catch (err) {
        logger.error('Failed to delete user', err)
        res.status(500).send({ err: 'Failed to delete user' })
    }
}

export async function updateUser(req, res) {
    try {
        const user = req.body
        const savedUser = await userService.update(user)
        res.send(savedUser)
    } catch (err) {
        logger.error('Failed to update user', err)
        res.status(500).send({ err: 'Failed to update user' })
    }
}

export async function loginUser(req, res) {
    try {
        const { username, adminPassword } = req.body
        
        if (!username) {
            return res.status(400).json({ err: 'Username is required' })
        }
        
        const user = await userService.getByUsername(username)
        
        // Check if user is admin and validate admin password
        if (user && user.permissions && user.permissions.roles && user.permissions.roles.includes('admin')) {
            if (!adminPassword) {
                return res.status(401).json({ err: 'Admin password required', requiresAdminPassword: true })
            }
            
            const correctAdminPassword = process.env.ADMIN_PASSWORD
            if (!correctAdminPassword) {
                logger.error('ADMIN_PASSWORD environment variable not set')
                return res.status(500).json({ err: 'Server configuration error' })
            }
            
            if (adminPassword !== correctAdminPassword) {
                return res.status(401).json({ err: 'Invalid admin password' })
            }
        }
        
        res.json(user)
    } catch (err) {
        logger.error('Failed to login user', err)
        res.status(500).json({ err: 'Failed to login user' })
    }
}