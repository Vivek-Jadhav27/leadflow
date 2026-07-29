import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import {
  Lead,
  CreateLeadInput,
  UpdateLeadInput,
  LeadFilterOptions,
  DashboardStats,
  SequenceType,
} from '@/types/lead';
import { CreateSequenceStepInput } from '@/types/sequence';
import { sequenceService } from './sequence.service';
import { getFirebaseErrorMessage } from '@/utils/firebaseError';

export class LeadService {
  private leadsCol = collection(db, 'leads');

  /**
   * Fetches all leads for a given user.
   */
  async getLeads(userId: string, filters?: LeadFilterOptions): Promise<Lead[]> {
    try {
      const q = query(
        this.leadsCol,
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch {
        const fallbackQ = query(this.leadsCol, where('createdBy', '==', userId));
        snapshot = await getDocs(fallbackQ);
      }

      let leads: Lead[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Lead[];

      if (!filters) return leads;

      if (filters.searchQuery && filters.searchQuery.trim() !== '') {
        const queryStr = filters.searchQuery.toLowerCase().trim();
        leads = leads.filter(
          (l) =>
            l.firstName.toLowerCase().includes(queryStr) ||
            l.lastName.toLowerCase().includes(queryStr) ||
            l.company.toLowerCase().includes(queryStr) ||
            l.email.toLowerCase().includes(queryStr) ||
            l.designation.toLowerCase().includes(queryStr)
        );
      }

      if (filters.sequenceType && filters.sequenceType !== 'All') {
        leads = leads.filter((l) => l.sequenceType === filters.sequenceType);
      }

      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'desc';

      leads.sort((a, b) => {
        let valA = (a[sortBy as keyof Lead] || '').toString().toLowerCase();
        let valB = (b[sortBy as keyof Lead] || '').toString().toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      return leads;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Fetches a single lead by ID.
   */
  async getLeadById(userId: string, leadId: string): Promise<Lead | null> {
    try {
      const docRef = doc(this.leadsCol, leadId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;

      const lead = { id: docSnap.id, ...docSnap.data() } as Lead;
      if (lead.createdBy !== userId) {
        throw new Error('Access denied: You do not own this lead.');
      }

      return lead;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Atomically creates Lead + Sequence + Sequence Steps.
   */
  async createLeadWithSequence(
    userId: string,
    input: CreateLeadInput,
    steps: CreateSequenceStepInput[]
  ): Promise<Lead> {
    try {
      const now = new Date().toISOString();
      const leadRef = doc(this.leadsCol);

      const leadData: Lead = {
        id: leadRef.id,
        ...input,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(leadRef, leadData);

      if (steps.length > 0) {
        await sequenceService.createSequenceWithSteps(leadRef.id, input.sequenceType, steps);
      }

      return leadData;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Updates an existing lead.
   */
  async updateLead(userId: string, leadId: string, input: UpdateLeadInput): Promise<void> {
    try {
      const docRef = doc(this.leadsCol, leadId);
      const now = new Date().toISOString();
      await updateDoc(docRef, {
        ...input,
        updatedAt: now,
      });
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Deletes a lead by ID.
   */
  async deleteLead(userId: string, leadId: string): Promise<void> {
    try {
      const docRef = doc(this.leadsCol, leadId);
      await deleteDoc(docRef);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Computes summary stats from user's leads and pending follow-ups.
   */
  calculateStats(leads: Lead[], todayPendingCount: number): DashboardStats {
    return {
      totalLeads: leads.length,
      linkedinSequences: leads.filter((l) => l.sequenceType === 'linkedin').length,
      emailSequences: leads.filter((l) => l.sequenceType === 'email').length,
      todayPendingFollowups: todayPendingCount,
    };
  }
}

export const leadService = new LeadService();
