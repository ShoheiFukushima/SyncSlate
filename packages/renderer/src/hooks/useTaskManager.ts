import { useState, useEffect, useCallback } from 'react';

interface Task {
  task_id: string;
  task_type: string;
  status: string;
  progress: number;
  current_step?: string;
  error_message?: string;
}

interface CreateTaskParams {
  task_type: string;
  project_id?: number;
  input_data?: any;
  estimated_time?: number;
}

interface UseTaskManagerReturn {
  tasks: Task[];
  activeTask: Task | null;
  createTask: (params: CreateTaskParams) => Promise<string>;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  clearCompleted: () => void;
  isLoading: boolean;
  error: string | null;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const useTaskManager = (): UseTaskManagerReturn => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // アクティブなタスクを取得
  const fetchActiveTasks = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/status/active`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.active_tasks || []);
        
        // 最新の処理中タスクを選択
        const processingTask = data.active_tasks.find(
          (t: Task) => t.status === 'processing'
        );
        setActiveTask(processingTask || data.active_tasks[0] || null);
      }
    } catch (err) {
      console.error('Error fetching active tasks:', err);
    }
  }, []);

  // 新しいタスクを作成
  const createTask = useCallback(async (params: CreateTaskParams): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create task');
      }
      
      const data = await response.json();
      
      // タスクリストを更新
      await fetchActiveTasks();
      
      // Celeryタスクを開始
      if (params.task_type === 'video_edit') {
        await startVideoEditTask(data.task_id, params.input_data);
      }
      
      return data.task_id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchActiveTasks]);

  // ビデオ編集タスクを開始
  const startVideoEditTask = async (taskId: string, inputData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_data: inputData }),
      });
      
      if (!response.ok) {
        console.error('Failed to start video edit task');
      }
    } catch (err) {
      console.error('Error starting video edit task:', err);
    }
  };

  // タスクをキャンセル
  const cancelTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      
      if (response.ok) {
        await fetchActiveTasks();
      }
    } catch (err) {
      console.error('Error cancelling task:', err);
    }
  }, [fetchActiveTasks]);

  // タスクをリトライ
  const retryTask = useCallback(async (taskId: string) => {
    try {
      // 失敗したタスクの情報を取得
      const taskResponse = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
      if (!taskResponse.ok) return;
      
      const task = await taskResponse.json();
      
      // 新しいタスクとして再作成
      await createTask({
        task_type: task.task_type,
        project_id: task.project_id,
        input_data: task.input_data,
        estimated_time: task.estimated_time,
      });
    } catch (err) {
      console.error('Error retrying task:', err);
    }
  }, [createTask]);

  // 完了したタスクをクリア
  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(task => 
      task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled'
    ));
  }, []);

  // 定期的にタスクを更新
  useEffect(() => {
    fetchActiveTasks();
    
    const interval = setInterval(fetchActiveTasks, 3000);
    
    return () => clearInterval(interval);
  }, [fetchActiveTasks]);

  return {
    tasks,
    activeTask,
    createTask,
    cancelTask,
    retryTask,
    clearCompleted,
    isLoading,
    error,
  };
};