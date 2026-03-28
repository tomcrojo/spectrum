export interface ProviderCapabilities {
  chat: boolean
  codeGen: boolean
  codeEdit: boolean
  fileRead: boolean
  shell: boolean
}

export interface ProviderInfo {
  id: string
  name: string
  description: string
  capabilities: ProviderCapabilities
  available: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  providerId?: string
}
