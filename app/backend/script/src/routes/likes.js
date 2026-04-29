import express from 'express';
import { db } from '../config/db.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

// Toggle like on a post (protected)
router.post('/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const [[post]] = await db.query('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already liked this post
    const [[existingLike]] = await db.query(
      'SELECT * FROM likes WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    if (existingLike) {
      // Unlike: Remove the like
      await db.query(
        'DELETE FROM likes WHERE user_id = ? AND post_id = ?',
        [userId, postId]
      );

      // Get updated like count
      const [[{ count }]] = await db.query(
        'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
        [postId]
      );

      return res.json({ 
        liked: false, 
        likes: count,
        message: 'Post unliked successfully' 
      });
    } else {
      // Like: Add the like
      await db.query(
        'INSERT INTO likes (user_id, post_id) VALUES (?, ?)',
        [userId, postId]
      );

      // Get updated like count
      const [[{ count }]] = await db.query(
        'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
        [postId]
      );

      return res.json({ 
        liked: true, 
        likes: count,
        message: 'Post liked successfully' 
      });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Get like status for a post (protected)
router.get('/:postId/status', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [[like]] = await db.query(
      'SELECT * FROM likes WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
      [postId]
    );

    res.json({ 
      liked: !!like,
      likes: count 
    });
  } catch (error) {
    console.error('Get like status error:', error);
    res.status(500).json({ error: 'Failed to get like status' });
  }
});

// Get all users who liked a post
router.get('/:postId/users', async (req, res) => {
  try {
    const { postId } = req.params;

    const [users] = await db.query(`
      SELECT u.id, u.username, l.created_at as liked_at
      FROM likes l
      JOIN users u ON l.user_id = u.id
      WHERE l.post_id = ?
      ORDER BY l.created_at DESC
    `, [postId]);

    res.json(users);
  } catch (error) {
    console.error('Get liked users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all posts liked by current user (protected)
router.get('/user/me', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [posts] = await db.query(`
      SELECT 
        p.*,
        u.username as owner_username,
        l.created_at as liked_at,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
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
    console.error('Get user likes error:', error);
    res.status(500).json({ error: 'Failed to fetch liked posts' });
  }
});

export default router;