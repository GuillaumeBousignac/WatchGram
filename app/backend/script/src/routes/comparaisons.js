import express from 'express';
import { db } from '../config/db.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

// Toggle comparison status (protected)
router.post('/:postId/toggle', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const [[post]] = await db.query('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if already in comparison list
    const [[existing]] = await db.query(
      'SELECT * FROM comparisons WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    if (existing) {
      // Remove from comparison
      await db.query(
        'DELETE FROM comparisons WHERE user_id = ? AND post_id = ?',
        [userId, postId]
      );

      return res.json({ 
        inComparison: false,
        message: 'Removed from comparison list' 
      });
    } else {
      // Check comparison list limit
      const [[{ count }]] = await db.query(
        'SELECT COUNT(*) as count FROM comparisons WHERE user_id = ?',
        [userId]
      );

      if (count >= 5) {
        return res.status(400).json({ error: 'Comparison list is full (max 5 items)' });
      }

      // Add to comparison
      await db.query(
        'INSERT INTO comparisons (user_id, post_id) VALUES (?, ?)',
        [userId, postId]
      );

      return res.json({ 
        inComparison: true,
        message: 'Added to comparison list' 
      });
    }
  } catch (error) {
    console.error('Toggle comparison error:', error);
    res.status(500).json({ error: 'Failed to toggle comparison' });
  }
});

// Get comparison status for a post (protected)
router.get('/:postId/status', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [[comparison]] = await db.query(
      'SELECT * FROM comparisons WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    res.json({ inComparison: !!comparison });
  } catch (error) {
    console.error('Get comparison status error:', error);
    res.status(500).json({ error: 'Failed to get comparison status' });
  }
});

// Get all posts in comparison list for current user (protected)
router.get('/user/me', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [posts] = await db.query(`
      SELECT 
        p.*,
        u.username as owner_username,
        c.added_at,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
      FROM comparisons c
      JOIN posts p ON c.post_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE c.user_id = ?
      ORDER BY c.added_at DESC
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
    console.error('Get comparison list error:', error);
    res.status(500).json({ error: 'Failed to fetch comparison list' });
  }
});

// Get count of items in comparison list (protected)
router.get('/count', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) as count FROM comparisons WHERE user_id = ?',
      [userId]
    );

    res.json({ count });
  } catch (error) {
    console.error('Get comparison count error:', error);
    res.status(500).json({ error: 'Failed to get comparison count' });
  }
});

// Clear all items from comparison list (protected)
router.delete('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query('DELETE FROM comparisons WHERE user_id = ?', [userId]);

    res.json({ message: 'Comparison list cleared successfully' });
  } catch (error) {
    console.error('Clear comparison list error:', error);
    res.status(500).json({ error: 'Failed to clear comparison list' });
  }
});

export default router;