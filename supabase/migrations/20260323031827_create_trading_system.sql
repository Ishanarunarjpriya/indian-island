/*
  # Create Trading System

  1. New Tables
    - `trades`
      - `id` (uuid, primary key)
      - `initiator_id` (text, trader initiating trade)
      - `receiver_id` (text, trader receiving trade)
      - `initiator_items` (jsonb, items offered by initiator)
      - `receiver_items` (jsonb, items requested from receiver)
      - `status` (text, 'pending' | 'accepted' | 'rejected' | 'completed')
      - `created_at` (timestamp)
      - `expires_at` (timestamp, trade expires after 1 hour)
      - `completed_at` (timestamp)

    - `trade_history`
      - `id` (uuid, primary key)
      - `trade_id` (uuid, foreign key)
      - `player1_id` (text)
      - `player2_id` (text)
      - `player1_items` (jsonb)
      - `player2_items` (jsonb)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can only see their own trades
*/

CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id text NOT NULL,
  receiver_id text NOT NULL,
  initiator_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  receiver_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '1 hour',
  completed_at timestamptz,
  CONSTRAINT different_players CHECK (initiator_id != receiver_id)
);

CREATE TABLE IF NOT EXISTS trade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES trades(id) ON DELETE SET NULL,
  player1_id text NOT NULL,
  player2_id text NOT NULL,
  player1_items jsonb NOT NULL,
  player2_items jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trades"
  ON trades FOR SELECT
  USING (
    initiator_id = session_user OR receiver_id = session_user
  );

CREATE POLICY "Users can create trade offers"
  ON trades FOR INSERT
  WITH CHECK (
    initiator_id = session_user
  );

CREATE POLICY "Receiver can accept or reject trade"
  ON trades FOR UPDATE
  USING (
    receiver_id = session_user OR initiator_id = session_user
  )
  WITH CHECK (
    receiver_id = session_user OR initiator_id = session_user
  );

CREATE POLICY "Users can view their trade history"
  ON trade_history FOR SELECT
  USING (
    player1_id = session_user OR player2_id = session_user
  );

CREATE POLICY "Anyone can insert trade history"
  ON trade_history FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_trades_initiator ON trades(initiator_id);
CREATE INDEX IF NOT EXISTS idx_trades_receiver ON trades(receiver_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_expires ON trades(expires_at);
CREATE INDEX IF NOT EXISTS idx_trade_history_players ON trade_history(player1_id, player2_id);
