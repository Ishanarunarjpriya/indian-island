import { createClient } from '@libsql/client';

let dbClient = null;

export function initTradingDb(client) {
  dbClient = client;
}

export async function createTrade(initiatorId, receiverId, initiatorItems, receiverItems) {
  if (!dbClient) throw new Error('Database not initialized');

  try {
    const result = await dbClient.execute({
      sql: `INSERT INTO trades (initiator_id, receiver_id, initiator_items, receiver_items)
            VALUES (?, ?, ?, ?)
            RETURNING *`,
      args: [
        initiatorId,
        receiverId,
        JSON.stringify(initiatorItems),
        JSON.stringify(receiverItems)
      ]
    });

    return result.rows[0];
  } catch (err) {
    console.error('[trading] Error creating trade:', err);
    throw err;
  }
}

export async function getTrade(tradeId) {
  if (!dbClient) throw new Error('Database not initialized');

  try {
    const result = await dbClient.execute({
      sql: `SELECT * FROM trades WHERE id = ?`,
      args: [tradeId]
    });

    if (result.rows.length === 0) return null;

    const trade = result.rows[0];
    return {
      ...trade,
      initiator_items: JSON.parse(trade.initiator_items || '[]'),
      receiver_items: JSON.parse(trade.receiver_items || '[]')
    };
  } catch (err) {
    console.error('[trading] Error fetching trade:', err);
    throw err;
  }
}

export async function getPlayerTrades(playerId) {
  if (!dbClient) throw new Error('Database not initialized');

  try {
    const result = await dbClient.execute({
      sql: `SELECT * FROM trades
            WHERE (initiator_id = ? OR receiver_id = ?)
            AND status != 'completed'
            ORDER BY created_at DESC`,
      args: [playerId, playerId]
    });

    return result.rows.map(trade => ({
      ...trade,
      initiator_items: JSON.parse(trade.initiator_items || '[]'),
      receiver_items: JSON.parse(trade.receiver_items || '[]')
    }));
  } catch (err) {
    console.error('[trading] Error fetching player trades:', err);
    throw err;
  }
}

export async function getTradeHistory(playerId, limit = 20) {
  if (!dbClient) throw new Error('Database not initialized');

  try {
    const result = await dbClient.execute({
      sql: `SELECT * FROM trade_history
            WHERE player1_id = ? OR player2_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [playerId, playerId, limit]
    });

    return result.rows.map(trade => ({
      ...trade,
      player1_items: JSON.parse(trade.player1_items || '[]'),
      player2_items: JSON.parse(trade.player2_items || '[]')
    }));
  } catch (err) {
    console.error('[trading] Error fetching trade history:', err);
    throw err;
  }
}

export async function acceptTrade(tradeId, receiverId) {
  if (!dbClient) throw new Error('Database not initialized');

  try {
    const trade = await getTrade(tradeId);
    if (!trade) throw new Error('Trade not found');
    if (trade.receiver_id !== receiverId) throw new Error('Not authorized to accept this trade');
    if (trade.status !== 'pending') throw new Error('Trade is no longer pending');

    const result = await dbClient.execute({
      sql: `UPDATE trades
            SET status = 'completed', completed_at = now()
            WHERE id = ?
            RETURNING *`,
      args: [tradeId]
    });

    const completedTrade = result.rows[0];

    await dbClient.execute({
      sql: `INSERT INTO trade_history (trade_id, player1_id, player2_id, player1_items, player2_items)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        tradeId,
        trade.initiator_id,
        trade.receiver_id,
        trade.initiator_items,
        trade.receiver_items
      ]
    });

    return { ...completedTrade, initiator_items: trade.initiator_items, receiver_items: trade.receiver_items };
  } catch (err) {
    console.error('[trading] Error accepting trade:', err);
    throw err;
  }
}

export async function rejectTrade(tradeId, receiverId) {
  if (!dbClient) throw new Error('Database not initialized');

  try {
    const trade = await getTrade(tradeId);
    if (!trade) throw new Error('Trade not found');
    if (trade.receiver_id !== receiverId) throw new Error('Not authorized to reject this trade');

    const result = await dbClient.execute({
      sql: `UPDATE trades SET status = 'rejected' WHERE id = ? RETURNING *`,
      args: [tradeId]
    });

    return result.rows[0];
  } catch (err) {
    console.error('[trading] Error rejecting trade:', err);
    throw err;
  }
}

export async function cancelTrade(tradeId, initiatorId) {
  if (!dbClient) throw new Error('Database not initialized');

  try {
    const trade = await getTrade(tradeId);
    if (!trade) throw new Error('Trade not found');
    if (trade.initiator_id !== initiatorId) throw new Error('Not authorized to cancel this trade');
    if (trade.status !== 'pending') throw new Error('Trade is no longer pending');

    const result = await dbClient.execute({
      sql: `UPDATE trades SET status = 'rejected' WHERE id = ? RETURNING *`,
      args: [tradeId]
    });

    return result.rows[0];
  } catch (err) {
    console.error('[trading] Error cancelling trade:', err);
    throw err;
  }
}
