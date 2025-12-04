import Swal from 'sweetalert2'

// Configuração padrão do SweetAlert2
const defaultConfig = {
  confirmButtonText: 'OK',
  confirmButtonColor: '#6366f1', // indigo-500
  cancelButtonText: 'Cancelar',
  cancelButtonColor: '#ef4444', // red-500
  buttonsStyling: true,
  customClass: {
    confirmButton: 'px-4 py-2 rounded-lg font-medium',
    cancelButton: 'px-4 py-2 rounded-lg font-medium',
  },
}

// Alerta de sucesso
export const showSuccess = (title, text = '') => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'success',
    title: title,
    text: text,
    confirmButtonColor: '#10b981', // green-500
  })
}

// Alerta de erro
export const showError = (title, text = '') => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'error',
    title: title,
    text: text,
    confirmButtonColor: '#ef4444', // red-500
  })
}

// Alerta de informação
export const showInfo = (title, text = '') => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'info',
    title: title,
    text: text,
  })
}

// Alerta de confirmação
export const showConfirm = (title, text = '', confirmText = 'Sim', cancelText = 'Cancelar') => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'warning',
    title: title,
    text: text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  })
}

// Alerta de confirmação para exclusão
export const showDeleteConfirm = (itemName, overrides = {}) => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'warning',
    title: overrides.title || 'Tem certeza?',
    html: overrides.html || `Deseja excluir <strong>"${itemName}"</strong>?<br><br>Esta ação não pode ser desfeita.`,
    showCancelButton: true,
    confirmButtonText: overrides.confirmButtonText || 'Sim, excluir!',
    cancelButtonText: overrides.cancelButtonText || 'Cancelar',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  })
}

// Toast de sucesso (notificação pequena)
export const showSuccessToast = (message) => {
  return Swal.fire({
    icon: 'success',
    title: message,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
  })
}

// Toast de erro
export const showErrorToast = (message) => {
  return Swal.fire({
    icon: 'error',
    title: message,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
  })
}

// Loading
export const showLoading = (title = 'Carregando...') => {
  Swal.fire({
    title: title,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading()
    },
  })
}

// Fechar loading
export const closeLoading = () => {
  Swal.close()
}

