import { useAuth } from '../context/AuthContext'

/**
 * Convenience hook for accessing auth context values.
 * Re-exports useAuth for components that prefer hook imports.
 */
export function useAuthHook() {
  return useAuth()
}

export { useAuth }
export default useAuth
