import { Link, useLocation, type LinkProps } from 'react-router'
// Carry only the current module's query string, never clinical payloads.
export function FilterLink({ to, ...props }: LinkProps) {
  const location = useLocation()
  const sameModule =
    typeof to === 'string' && to.split('/')[1] === location.pathname.split('/')[1]
  return (
    <Link
      {...props}
      to={sameModule && !to.includes('?') ? `${to}${location.search}` : to}
    />
  )
}
