import express from 'express';
import { db } from '../config/db.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

// Toggle favorite on a post (protected)
router.post('/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const [[post]] = await db.query('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already favorited this post
    const [[existingFavorite]] = await db.query(
      'SELECT * FROM favorites WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    if (existingFavorite) {
      // Remove from favorites
      await db.query(
        'DELETE FROM favorites WHERE user_id = ? AND post_id = ?',
        [userId, postId]
      );

      return res.json({ 
        favorited: false, 
        message: 'Removed from favorites' 
      });
    } else {
      // Add to favorites
      await db.query(
        'INSERT INTO favorites (user_id, post_id) VALUES (?, ?)',
        [userId, postId]
      );

      return res.json({ 
        favorited: true, 
        message: 'Added to favorites' 
      });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Get favorite status for a post (protected)
router.get('/:postId/status', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [[favorite]] = await db.query(
      'SELECT * FROM favorites WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    res.json({ favorited: !!favorite });
  } catch (error) {
    console.error('Get favorite status error:', error);
    res.status(500).json({ error: 'Failed to get favorite status' });
  }
});

// Get all favorite posts for current user (protected)
router.get('/user/me', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [posts] = await db.query(`
      SELECT 
        p.*,
        u.username as owner_username,
        f.created_at as favorited_at,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
      FROM favorites f
      JOIN posts p ON f.post_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);

    // Get images for each post
    for (let post of posts) {
      const [images] = await db.query(
        'SELECT image_url FROM post_images WHERE post_id = ? ORDER BY position',
        [post.id]
      );
      post.images = images.map(img => img.image_url);
    }

    res.json(posts);
  } catch (error) {
    console.error('Get user favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorite posts' });
  }
});

// Get count of favorites for current user (protected)
router.get('/count', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) as count FROM favorites WHERE user_id = ?',
      [userId]
    );

    res.json({ count });
  } catch (error) {
    console.error('Get favorites count error:', error);
    res.status(500).json({ error: 'Failed to get favorites count' });
  }
});

// Remove a specific favorite (protected)
router.delete('/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [result] = await db.query(
      'DELETE FROM favorites WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ message: 'Removed from favorites successfully' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Clear all favorites for current user (protected)
router.delete('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query('DELETE FROM favorites WHERE user_id = ?', [userId]);

    res.json({ message: 'All favorites cleared successfully' });
  } catch (error) {
    console.error('Clear favorites error:', error);
    res.status(500).json({ error: 'Failed to clear favorites' });
  }
});

export default router;