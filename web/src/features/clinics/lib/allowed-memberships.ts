import type { AuthenticatedUser } from '../../auth/types/auth'
import type { ClinicMembership } from '../types/clinic'

export function getAllowedMemberships(
  user: AuthenticatedUser,
  memberships: ClinicMembership[],
): ClinicMembership[] {
  const rolesByClinic = new Map(
    user.clinicRoles.map((membership) => [membership.clinicId, membership.role]),
  )

  return memberships.filter((membership) => {
    const authenticatedRole = rolesByClinic.get(membership.clinicId)
    return (
      membership.active &&
      membership.clinic?.active === true &&
      authenticatedRole === membership.role
    )
  })
}
