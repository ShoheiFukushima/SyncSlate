import React, { useState, useEffect } from 'react';
import { CircularProgress, LinearProgress, Alert, Box, Card, CardContent, Typography, Chip, Grid, IconButton, Collapse } from '@mui/material';
import { ExpandMore, ExpandLess, CheckCircle, Error, Cancel, HourglassEmpty, PlayArrow } from '@mui/icons-material';

interface Task {
  task_id: string;
  task_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step?: string;
  total_steps?: number;
  completed_steps?: number;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  estimated_time?: number;
  actual_time?: number;
  error_message?: string;
}

interface TaskLog {
  id: number;
  timestamp: string;
  level: string;
  message: string;
  step_name?: string;
  step_progress?: number;
}

interface TaskStatusProps {
  taskId: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

const TaskStatus: React.FC<TaskStatusProps> = ({ taskId, onComplete, onError }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    // 初期データの取得
    fetchTaskStatus();
    fetchTaskLogs();

    // WebSocket接続
    const ws = connectWebSocket();

    // ポーリング（フォールバック）
    const interval = setInterval(() => {
      if (!wsConnected) {
        fetchTaskStatus();
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (ws) {
        ws.close();
      }
    };
  }, [taskId]);

  const fetchTaskStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
      if (response.ok) {
        const data = await response.json();
        setTask(data);
        setLoading(false);

        // 完了時のコールバック
        if (data.status === 'completed' && onComplete) {
          onComplete(data);
        }

        // エラー時のコールバック
        if (data.status === 'failed' && onError) {
          onError(data.error_message || 'Task failed');
        }
      }
    } catch (error) {
      console.error('Error fetching task status:', error);
      setLoading(false);
    }
  };

  const fetchTaskLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/logs`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching task logs:', error);
    }
  };

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`ws://localhost:8000/api/status/ws/${taskId}`);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        ws.send('ping');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.task_id === taskId) {
          setTask(prev => ({ ...prev, ...data }));
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
      };

      return ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <HourglassEmpty color="action" />;
      case 'processing':
        return <PlayArrow color="primary" />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'cancelled':
        return <Cancel color="warning" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'processing':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!task) {
    return (
      <Alert severity="error">
        Task not found: {taskId}
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8}>
            <Box display="flex" alignItems="center" gap={2}>
              {getStatusIcon(task.status)}
              <Typography variant="h6">
                {task.task_type}
              </Typography>
              <Chip
                label={task.status.toUpperCase()}
                color={getStatusColor(task.status) as any}
                size="small"
              />
              {wsConnected && (
                <Chip
                  label="LIVE"
                  color="success"
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Grid>
          <Grid item xs={12} sm={4} textAlign="right">
            <IconButton onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Grid>
        </Grid>

        {/* プログレスバー */}
        {task.status === 'processing' && (
          <Box mt={2}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="textSecondary">
                {task.current_step || 'Processing...'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {Math.round(task.progress)}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={task.progress} />
            {task.total_steps && task.completed_steps !== undefined && (
              <Typography variant="caption" color="textSecondary" mt={1}>
                Step {task.completed_steps} of {task.total_steps}
              </Typography>
            )}
          </Box>
        )}

        {/* エラーメッセージ */}
        {task.status === 'failed' && task.error_message && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {task.error_message}
          </Alert>
        )}

        {/* 詳細情報 */}
        <Collapse in={expanded}>
          <Box mt={3}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Task ID
                </Typography>
                <Typography variant="body2">
                  {task.task_id}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Created
                </Typography>
                <Typography variant="body2">
                  {formatTimestamp(task.created_at)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Started
                </Typography>
                <Typography variant="body2">
                  {formatTimestamp(task.started_at)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Completed
                </Typography>
                <Typography variant="body2">
                  {formatTimestamp(task.completed_at)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Estimated Time
                </Typography>
                <Typography variant="body2">
                  {formatDuration(task.estimated_time)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Actual Time
                </Typography>
                <Typography variant="body2">
                  {formatDuration(task.actual_time)}
                </Typography>
              </Grid>
            </Grid>

            {/* ログ表示 */}
            {logs.length > 0 && (
              <Box mt={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Activity Log
                </Typography>
                <Box
                  sx={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    bgcolor: 'background.default',
                    p: 1,
                    borderRadius: 1,
                  }}
                >
                  {logs.map((log) => (
                    <Box key={log.id} mb={1}>
                      <Typography
                        variant="caption"
                        color={log.level === 'ERROR' ? 'error' : 'textSecondary'}
                      >
                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.level}
                      </Typography>
                      <Typography variant="body2">
                        {log.message}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default TaskStatus;