const express = require('express');
const { supabase } = require('../supabase');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me
router.get('/me', requireUser, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, username, created_at')
      .eq('user_id', req.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get RPG character stats
    const { data: character } = await supabase
      .from('characters')
      .select('level, current_exp, exp_to_next_level')
      .eq('user_id', req.userId)
      .single();

    const level = character?.level ?? 1;
    const exp = character?.current_exp ?? 0;
    const nextExp = character?.exp_to_next_level ?? 100;
    const levelProgress = nextExp > 0 ? Math.floor((exp / nextExp) * 100) : 0;

    return res.json({
      name: user.username,
      level,
      levelProgress,
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/users/me/stats
router.get('/me/stats', requireUser, async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Fetch actual character stats for HP and EXP
    const { data: character } = await supabase
      .from('characters')
      .select('current_hp, max_hp, current_exp')
      .eq('user_id', req.userId)
      .single();

    // Count logs in the last 7 days (streak approximation)
    const { count: weekLogs } = await supabase
      .from('habit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .gte('log_date', sevenDaysAgo.toISOString().split('T')[0]);

    const hp = character?.current_hp ?? 100;
    const maxHp = character?.max_hp ?? 100;
    // Scale EXP to 100-max for frontend progress bar
    const exp = character?.current_exp ?? 0;
    const streak = weekLogs ?? 0;

    return res.json([
      { label: 'HP', value: hp, max: maxHp, color: '#EF4444', icon: 'heart' },
      { label: 'EXP', value: exp % 100, max: 100, color: '#3B82F6', icon: 'flash' }, // Using modulo 100 to show bar progress
      { label: 'Streaks', value: streak, max: 7, color: '#F59E0B', icon: 'flame' },
    ]);
  } catch (err) {
    console.error('Get stats error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
