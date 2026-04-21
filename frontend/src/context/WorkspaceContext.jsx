import { createContext, startTransition, useContext, useEffect, useMemo, useState } from 'react'
import { showErrorToast, showSuccessToast } from '../utils/alerts'
import {
  buscarWorkspace,
  criarEspaco as criarEspacoAPI,
  excluirEspaco as excluirEspacoAPI,
  criarProjeto as criarProjetoAPI,
  criarKanban as criarKanbanAPI,
  renomearEspaco as renomearEspacoAPI,
  vincularIdeiaAoProjeto as vincularIdeiaAoProjetoAPI,
} from '../services/workspaceService'

const WORKSPACE_PROJECT_STORAGE_KEY = 'sacola_workspace_project_id'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [espacos, setEspacos] = useState([])
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    if (typeof window === 'undefined') {
      return null
    }

    const storedValue = localStorage.getItem(WORKSPACE_PROJECT_STORAGE_KEY)
    return storedValue ? Number(storedValue) : null
  })

  useEffect(() => {
    carregarWorkspace()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (selectedProjectId) {
      localStorage.setItem(WORKSPACE_PROJECT_STORAGE_KEY, String(selectedProjectId))
    } else {
      localStorage.removeItem(WORKSPACE_PROJECT_STORAGE_KEY)
    }
  }, [selectedProjectId])

  async function carregarWorkspace() {
    setLoadingWorkspace(true)
    try {
      const arvore = await buscarWorkspace()
      setEspacos(arvore)
    } catch (error) {
      console.error('Erro ao carregar workspace:', error)
      showErrorToast(error.message || 'Nao foi possivel carregar os espacos e projetos.')
      setEspacos([])
    } finally {
      setLoadingWorkspace(false)
    }
  }

  const projectOptions = useMemo(
    () =>
      espacos.flatMap((espaco) =>
        (espaco.projetos || []).map((projeto) => ({
          ...projeto,
          espaco_nome: espaco.nome,
          espaco_id: espaco.id,
        })),
      ),
    [espacos],
  )

  const kanbanOptions = useMemo(
    () =>
      projectOptions.flatMap((projeto) =>
        (projeto.kanbans || []).map((kanban) => ({
          ...kanban,
          projeto_id: projeto.id,
          projeto_nome: projeto.nome,
          espaco_id: projeto.espaco_id,
          espaco_nome: projeto.espaco_nome,
        })),
      ),
    [projectOptions],
  )

  const selectedProject = useMemo(
    () => projectOptions.find((projeto) => projeto.id === selectedProjectId) || null,
    [projectOptions, selectedProjectId],
  )

  const selectedSpace = useMemo(
    () => espacos.find((espaco) => espaco.id === selectedProject?.espaco_id) || null,
    [espacos, selectedProject],
  )

  useEffect(() => {
    if (!selectedProjectId) {
      return
    }

    const exists = projectOptions.some((projeto) => projeto.id === selectedProjectId)
    if (!exists) {
      setSelectedProjectId(null)
    }
  }, [projectOptions, selectedProjectId])

  function selecionarProjeto(projectId) {
    startTransition(() => {
      setSelectedProjectId(projectId ? Number(projectId) : null)
    })
  }

  async function criarEspaco(payload) {
    setSavingWorkspace(true)
    try {
      const espaco = await criarEspacoAPI(payload)
      await carregarWorkspace()
      showSuccessToast('Espaco criado com sucesso!')
      return espaco
    } catch (error) {
      console.error('Erro ao criar espaco:', error)
      showErrorToast(error.message || 'Nao foi possivel criar o espaco.')
      throw error
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function criarProjeto(payload) {
    setSavingWorkspace(true)
    try {
      const projeto = await criarProjetoAPI(payload)
      await carregarWorkspace()
      selecionarProjeto(projeto.id)
      showSuccessToast('Projeto criado com sucesso!')
      return projeto
    } catch (error) {
      console.error('Erro ao criar projeto:', error)
      showErrorToast(error.message || 'Nao foi possivel criar o projeto.')
      throw error
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function criarKanban(payload) {
    setSavingWorkspace(true)
    try {
      const kanban = await criarKanbanAPI(payload)
      await carregarWorkspace()
      showSuccessToast('Kanban criado com sucesso!')
      return kanban
    } catch (error) {
      console.error('Erro ao criar kanban:', error)
      showErrorToast(error.message || 'Nao foi possivel criar o kanban.')
      throw error
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function renomearEspaco(espacoId, payload) {
    setSavingWorkspace(true)
    try {
      const espaco = await renomearEspacoAPI(espacoId, payload)
      await carregarWorkspace()
      showSuccessToast('Espaco renomeado com sucesso!')
      return espaco
    } catch (error) {
      console.error('Erro ao renomear espaco:', error)
      showErrorToast(error.message || 'Nao foi possivel renomear o espaco.')
      throw error
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function excluirEspaco(espacoId) {
    setSavingWorkspace(true)
    try {
      const response = await excluirEspacoAPI(espacoId)
      await carregarWorkspace()
      showSuccessToast('Espaco excluido com sucesso!')
      return response
    } catch (error) {
      console.error('Erro ao excluir espaco:', error)
      showErrorToast(error.message || 'Nao foi possivel excluir o espaco.')
      throw error
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function vincularIdeiaAoProjeto(ideiaId, projetoId, kanbanId = null) {
    try {
      const ideiaAtualizada = await vincularIdeiaAoProjetoAPI(ideiaId, projetoId, kanbanId)
      await carregarWorkspace()
      showSuccessToast(projetoId ? 'Ideia vinculada ao projeto!' : 'Vinculo com o projeto removido.')
      return ideiaAtualizada
    } catch (error) {
      console.error('Erro ao vincular ideia ao projeto:', error)
      showErrorToast(error.message || 'Nao foi possivel atualizar o projeto da ideia.')
      throw error
    }
  }

  const value = useMemo(
    () => ({
      espacos,
      loadingWorkspace,
      savingWorkspace,
      selectedProjectId,
      selectedProject,
      selectedSpace,
      projectOptions,
      kanbanOptions,
      selecionarProjeto,
      carregarWorkspace,
      criarEspaco,
      renomearEspaco,
      excluirEspaco,
      criarProjeto,
      criarKanban,
      vincularIdeiaAoProjeto,
    }),
    [
      espacos,
      loadingWorkspace,
      savingWorkspace,
      selectedProjectId,
      selectedProject,
      selectedSpace,
      projectOptions,
      kanbanOptions,
    ],
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace deve ser usado dentro de WorkspaceProvider')
  }
  return context
}
