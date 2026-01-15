import { getAuthToken } from '@/utils/auth';

const API_BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1313';

export interface DebateAssumption {
    id?: string;
    debateId: string;
    participantId?: string;
    participantEmail?: string;
    side: string;
    assumptions: string[];
    createdAt?: string;
}

export interface AssumptionsResponse {
    assumptions: DebateAssumption[];
    count: number;
}

export const assumptionService = {
    /**
     * Fetch assumptions for a specific debate
     * @param debateId - The ID of the debate
     * @returns Promise with assumptions data
     */
    async getDebateAssumptions(debateId: string): Promise<AssumptionsResponse> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication token not found');
        }

        const response = await fetch(
            `${API_BASE_URL}/debates/${debateId}/assumptions`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            let errorMessage = 'Failed to fetch assumptions';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        return response.json();
    },
};
