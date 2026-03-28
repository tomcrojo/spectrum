import { useEffect, useState } from 'react'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { Input } from '@renderer/components/shared/Input'
import { cn } from '@renderer/lib/cn'

interface TaskListProps {
  projectId: string
}

export function TaskList({ projectId }: TaskListProps) {
  const { tasks, loadTasks, createTask, toggleTask, deleteTask } =
    useProjectsStore()
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    loadTasks(projectId)
  }, [projectId, loadTasks])

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    await createTask({ projectId, title })
    setNewTitle('')
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Tasks
      </h3>

      <div className="space-y-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover transition-colors"
          >
            <button
              onClick={() => toggleTask(task.id)}
              className={cn(
                'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                task.completed
                  ? 'bg-success border-success'
                  : 'border-border hover:border-text-muted'
              )}
            >
              {task.completed && (
                <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2.5 5L4.5 7L7.5 3"
                    stroke="white"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <span
              className={cn(
                'flex-1 text-sm',
                task.completed
                  ? 'text-text-muted line-through'
                  : 'text-text-primary'
              )}
            >
              {task.title}
            </span>
            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all text-xs"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="Add a task..."
          className="flex-1"
        />
      </div>
    </div>
  )
}
