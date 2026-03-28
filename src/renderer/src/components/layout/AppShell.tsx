import { Sidebar } from './Sidebar'
import { Canvas } from '@renderer/components/canvas/Canvas'
import { ProjectPage } from '@renderer/components/project/ProjectPage'
import { NewProjectModal } from '@renderer/components/sidebar/NewProjectModal'

export function AppShell() {
  return (
    <div className="flex h-screen w-screen bg-bg overflow-hidden">
      {/* Sidebar — fixed width */}
      <div className="w-60 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content — canvas + optional project page panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas — always visible, fills available space */}
        <Canvas />

        {/* Project page — toggleable right panel */}
        <ProjectPage />
      </div>

      {/* Modals */}
      <NewProjectModal />
    </div>
  )
}
