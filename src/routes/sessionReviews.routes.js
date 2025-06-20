const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/session-reviews - Get session reviews for a specific date
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const reviews = await prisma.sessionReview.findMany({
      where: {
        date: new Date(date)
      },
      orderBy: {
        reviewedAt: 'desc'
      }
    });

    return res.json(reviews);
  } catch (error) {
    console.error('Session Reviews API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/session-reviews - Mark a session as reviewed
router.post('/', async (req, res) => {
  try {
    const { sessionId, date, reviewedBy } = req.body;

    if (!sessionId || !date || !reviewedBy) {
      return res.status(400).json({ 
        error: 'sessionId, date, and reviewedBy are required' 
      });
    }

    // Get current session state to store with review
    const dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule state not found' });
    }

    // Find the session in the state
    const sessions = dailyState.sessions;
    const session = sessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Create or update review
    const review = await prisma.sessionReview.upsert({
      where: {
        date_sessionId: {
          date: new Date(date),
          sessionId: sessionId
        }
      },
      update: {
        reviewedAt: new Date(),
        reviewedBy: reviewedBy,
        sessionStateAtReview: session
      },
      create: {
        date: new Date(date),
        sessionId: sessionId,
        reviewedAt: new Date(),
        reviewedBy: reviewedBy,
        sessionStateAtReview: session
      }
    });

    // Update the session in the daily state to mark as reviewed
    const updatedSessions = sessions.map(s => 
      s.sessionId === sessionId 
        ? { 
            ...s, 
            reviewed: true, 
            reviewedAt: new Date(),
            reviewedBy: reviewedBy
          }
        : s
    );

    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions: updatedSessions,
        updatedAt: new Date()
      }
    });

    return res.json(review);
  } catch (error) {
    console.error('Session Reviews API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/session-reviews - Remove a review (unreview a session)
router.delete('/', async (req, res) => {
  try {
    const { date, sessionId } = req.query;

    if (!date || !sessionId) {
      return res.status(400).json({ 
        error: 'Date and sessionId parameters are required' 
      });
    }

    await prisma.sessionReview.delete({
      where: {
        date_sessionId: {
          date: new Date(date),
          sessionId: sessionId
        }
      }
    });

    // Update the session in daily state to mark as not reviewed
    const dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (dailyState) {
      const sessions = dailyState.sessions;
      const updatedSessions = sessions.map(s => 
        s.sessionId === sessionId 
          ? { 
              ...s, 
              reviewed: false, 
              reviewedAt: undefined,
              reviewedBy: undefined
            }
          : s
      );

      await prisma.dailyScheduleState.update({
        where: { date: new Date(date) },
        data: {
          sessions: updatedSessions,
          updatedAt: new Date()
        }
      });
    }

    return res.status(204).end();
  } catch (error) {
    console.error('Session Reviews API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;