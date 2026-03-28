import { Sidebar } from './Sidebar'
import { ProjectPage } from '@renderer/components/project/ProjectPage'
import { NewProjectModal } from '@renderer/components/sidebar/NewProjectModal'

export function AppShell() {
  return (
    <div className="flex h-screen w-screen bg-bg overflow-hidden">
      {/* Sidebar — fixed width */}
      <div className="w-60 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex bg-bg">
        <ProjectPage />
      </div>

      {/* Modals */}
      <NewProjectModal />
    </div>
  )
}
