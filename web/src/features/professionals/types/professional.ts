export interface Professional {
  id: string;
  userId: string;
  crm: string;
  crmState: string;
  rqe: string | null;
  specialty: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; active: boolean };
}
export interface ProfessionalFields {
  crm: string;
  crmState: string;
  rqe: string | null;
  specialty: string;
}
export interface CreateProfessionalPayload extends ProfessionalFields {
  userId: string;
}
export interface ProfessionalMembership {
  id: string;
  clinicId: string;
  userId: string;
  role: string;
  active: boolean;
  user?: { id: string; name: string; email: string; active: boolean };
}
