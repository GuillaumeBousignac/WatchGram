import express from 'express';
import { db } from '../config/db.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

// Get all posts
router.get('/', async (req, res) => {
  try {
    const [posts] = await db.query(`
      SELECT 
        p.*,
        u.username as owner_username,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);

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
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post by ID
router.get('/:id', async (req, res) => {
  try {
    const [[post]] = await db.query(`
      SELECT 
        p.*,
        u.username as owner_username,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get images for this post
    const [images] = await db.query(
      'SELECT image_url FROM post_images WHERE post_id = ? ORDER BY position',
      [req.params.id]
    );
    post.images = images.map(img => img.image_url);

    // Get comments for this post
    const [comments] = await db.query(`
      SELECT c.*, u.username 
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at DESC
    `, [req.params.id]);

    post.comments = comments;

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create a new post (protected)
router.post('/', auth, async (req, res) => {
  try {
    const { 
      name, 
      brand, 
      images, 
      price, 
      diameter, 
      thickness, 
      waterResistance, 
      movement, 
      material 
    } = req.body;

    console.log('📥 Received post request');
    console.log('User ID:', req.user?.id);
    console.log('Post data:', { name, brand, price, diameter, images_count: images?.length });

    // Validation
    if (!name || !brand || !price) {
      console.log('❌ Validation failed: missing required fields');
      return res.status(400).json({ error: 'Missing required fields (name, brand, price)' });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      console.log('❌ Validation failed: no images');
      return res.status(400).json({ error: 'At least one image is required' });
    }

    if (!req.user || !req.user.id) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('✅ Validation passed, inserting post...');

    // Insert post
    const [result] = await db.query(`
      INSERT INTO posts (
        user_id, name, brand, price, diameter, 
        thickness, water_resistance, movement, material
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      name,
      brand,
      price,
      diameter || null,
      thickness || null,
      waterResistance || null,
      movement || null,
      material || null
    ]);

    const postId = result.insertId;
    console.log('✅ Post inserted with ID:', postId);

    // Insert images
    for (let i = 0; i < images.length; i++) {
      console.log(`📸 Inserting image ${i + 1}/${images.length} (size: ${images[i].length} chars)`);
      await db.query(
        'INSERT INTO post_images (post_id, image_url, position) VALUES (?, ?, ?)',
        [postId, images[i], i]
      );
    }

    console.log('✅ All images inserted');

    // Fetch the created post
    const [[newPost]] = await db.query(
      'SELECT * FROM posts WHERE id = ?',
      [postId]
    );

    const [postImages] = await db.query(
      'SELECT image_url FROM post_images WHERE post_id = ? ORDER BY position',
      [postId]
    );
    newPost.images = postImages.map(img => img.image_url);

    console.log('✅ Post created successfully');

    res.status(201).json(newPost);
  } catch (error) {
    console.error('❌ Create post error:', error.message);
    console.error('Error code:', error.code);
    console.error('Error sqlMessage:', error.sqlMessage);
    console.error('Full error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      code: error.code 
    });
  }
});

// Update a post (protected, owner only)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if post exists and belongs to user
    const [[post]] = await db.query(
      'SELECT * FROM posts WHERE id = ?',
      [id]
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this post' });
    }

    const { 
      name, 
      brand, 
      images, 
      price, 
      diameter, 
      thickness, 
      waterResistance, 
      movement, 
      material 
    } = req.body;

    // Update post
    await db.query(`
      UPDATE posts SET
        name = ?,
        brand = ?,
        price = ?,
        diameter = ?,
        thickness = ?,
        water_resistance = ?,
        movement = ?,
        material = ?
      WHERE id = ?
    `, [
      name || post.name,
      brand || post.brand,
      price !== undefined ? price : post.price,
      diameter !== undefined ? diameter : post.diameter,
      thickness !== undefined ? thickness : post.thickness,
      waterResistance !== undefined ? waterResistance : post.water_resistance,
      movement || post.movement,
      material || post.material,
      id
    ]);

    // Update images if provided
    if (images && Array.isArray(images) && images.length > 0) {
      // Delete old images
      await db.query('DELETE FROM post_images WHERE post_id = ?', [id]);
      
      // Insert new images
      for (let i = 0; i < images.length; i++) {
        await db.query(
          'INSERT INTO post_images (post_id, image_url, position) VALUES (?, ?, ?)',
          [id, images[i], i]
        );
      }
    }

    // Fetch updated post
    const [[updatedPost]] = await db.query(
      'SELECT * FROM posts WHERE id = ?',
      [id]
    );

    const [postImages] = await db.query(
      'SELECT image_url FROM post_images WHERE post_id = ? ORDER BY position',
      [id]
    );
    updatedPost.images = postImages.map(img => img.image_url);

    res.json(updatedPost);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete a post (protected, owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if post exists and belongs to user
    const [[post]] = await db.query(
      'SELECT * FROM posts WHERE id = ?',
      [id]
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Delete the post (cascade will handle related data)
    await db.query('DELETE FROM posts WHERE id = ?', [id]);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Add a comment to a post (protected)
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, content } = req.body;
    
    const commentText = text || content;

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    // Check if post exists
    const [[post]] = await db.query('SELECT id FROM posts WHERE id = ?', [id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [result] = await db.query(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [id, req.user.id, commentText]
    );

    const [[comment]] = await db.query(`
      SELECT c.*, u.username 
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

    res.status(201).json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for a post
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;

    const [comments] = await db.query(`
      SELECT c.*, u.username 
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at DESC
    `, [id]);

    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

export default router;