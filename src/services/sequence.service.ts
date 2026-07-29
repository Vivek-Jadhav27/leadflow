import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Lead, SequenceType } from '@/types/lead';
import {
  Sequence,
  SequenceStep,
  CreateSequenceStepInput,
  PendingFollowUp,
} from '@/types/sequence';
import { getFirebaseErrorMessage } from '@/utils/firebaseError';
import { isTodayOrOverdue } from '@/utils/date';

export class SequenceService {
  private sequencesCol = collection(db, 'sequences');
  private stepsCol = collection(db, 'sequenceSteps');

  /**
   * Creates a sequence header record and all generated sequence steps in Firestore.
   */
  async createSequenceWithSteps(
    leadId: string,
    type: SequenceType,
    steps: CreateSequenceStepInput[]
  ): Promise<{ sequence: Sequence; steps: SequenceStep[] }> {
    try {
      const now = new Date().toISOString();
      const batch = writeBatch(db);

      // 1. Create Sequence doc
      const sequenceRef = doc(this.sequencesCol);
      const sequenceData: Sequence = {
        id: sequenceRef.id,
        leadId,
        type,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(sequenceRef, sequenceData);

      // 2. Create Sequence Step docs
      const createdSteps: SequenceStep[] = [];
      steps.forEach((stepInput) => {
        const stepRef = doc(this.stepsCol);
        const stepData: SequenceStep = {
          id: stepRef.id,
          sequenceId: sequenceRef.id,
          leadId,
          stepNumber: stepInput.stepNumber,
          scheduledDate: stepInput.scheduledDate,
          message: stepInput.message,
          subject: stepInput.subject || '',
          status: 'Pending',
          createdAt: now,
          updatedAt: now,
        };
        batch.set(stepRef, stepData);
        createdSteps.push(stepData);
      });

      await batch.commit();
      return { sequence: sequenceData, steps: createdSteps };
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Fetches the Sequence record for a given Lead ID.
   */
  async getSequenceByLeadId(leadId: string): Promise<Sequence | null> {
    try {
      const q = query(this.sequencesCol, where('leadId', '==', leadId));
      const querySnap = await getDocs(q);
      if (querySnap.empty) return null;

      const docSnap = querySnap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Sequence;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Fetches all SequenceStep records for a given Sequence ID ordered by step number.
   */
  async getStepsBySequenceId(sequenceId: string): Promise<SequenceStep[]> {
    try {
      const q = query(
        this.stepsCol,
        where('sequenceId', '==', sequenceId),
        orderBy('stepNumber', 'asc')
      );
      const querySnap = await getDocs(q);
      return querySnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as SequenceStep[];
    } catch (error) {
      // Fallback without explicit composite index if index is missing in firestore
      try {
        const fallbackQ = query(this.stepsCol, where('sequenceId', '==', sequenceId));
        const fallbackSnap = await getDocs(fallbackQ);
        const list = fallbackSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as SequenceStep[];
        return list.sort((a, b) => a.stepNumber - b.stepNumber);
      } catch (fallbackErr) {
        throw new Error(getFirebaseErrorMessage(fallbackErr || error));
      }
    }
  }

  /**
   * Fetches all pending follow-up steps scheduled for Today or overdue for the user's leads.
   */
  async getTodayPendingFollowUps(userLeads: Lead[]): Promise<PendingFollowUp[]> {
    try {
      if (userLeads.length === 0) return [];

      const leadMap = new Map<string, Lead>();
      userLeads.forEach((lead) => leadMap.set(lead.id, lead));

      const leadIds = Array.from(leadMap.keys());
      const pendingFollowUps: PendingFollowUp[] = [];

      // Firestore 'in' query allows up to 30 elements per batch
      const chunkSize = 30;
      for (let i = 0; i < leadIds.length; i += chunkSize) {
        const chunk = leadIds.slice(i, i + chunkSize);
        const q = query(
          this.stepsCol,
          where('leadId', 'in', chunk),
          where('status', '==', 'Pending')
        );

        const querySnap = await getDocs(q);
        querySnap.docs.forEach((docSnap) => {
          const step = { id: docSnap.id, ...docSnap.data() } as SequenceStep;
          if (isTodayOrOverdue(step.scheduledDate)) {
            const lead = leadMap.get(step.leadId);
            if (lead) {
              pendingFollowUps.push({ step, lead });
            }
          }
        });
      }

      // Sort by scheduledDate ascending, then by stepNumber ascending
      return pendingFollowUps.sort((a, b) => {
        if (a.step.scheduledDate !== b.step.scheduledDate) {
          return a.step.scheduledDate.localeCompare(b.step.scheduledDate);
        }
        return a.step.stepNumber - b.step.stepNumber;
      });
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Marks a sequence step as 'Sent' with current timestamp.
   */
  async markStepAsSent(stepId: string): Promise<void> {
    try {
      const stepRef = doc(this.stepsCol, stepId);
      const now = new Date().toISOString();
      await updateDoc(stepRef, {
        status: 'Sent',
        sentAt: now,
        updatedAt: now,
      });
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Marks a sequence step as 'Skipped'.
   */
  async skipStep(stepId: string): Promise<void> {
    try {
      const stepRef = doc(this.stepsCol, stepId);
      const now = new Date().toISOString();
      await updateDoc(stepRef, {
        status: 'Skipped',
        updatedAt: now,
      });
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }
}

export const sequenceService = new SequenceService();
