import { useAuthStore } from "../store/authStore";

export function useCompanyContext() {
  const {
    activeCompanyId,
    userCompanies,
    setActiveCompany,
    clearActiveCompany,
    companiesLoading,
    fetchUserCompanies,
  } = useAuthStore();

  const currentCompany =
    userCompanies.find((c) => c.id === activeCompanyId) ?? null;

  return {
    activeCompanyId: activeCompanyId ?? null,
    currentCompany,
    userCompanies,
    setActiveCompany,
    clearActiveCompany,
    companiesLoading,
    fetchUserCompanies,
  };
}
