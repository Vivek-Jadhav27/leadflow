import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Lead, CreateLeadInput, UpdateLeadInput } from '@/types/lead';

export class LeadRepository {
  private collectionName = 'leads';

  private mapDocToLead(snapshot: QueryDocumentSnapshot<DocumentData>): Lead {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      company: data.company || '',
      designation: data.designation || '',
      email: data.email || '',
      phone: data.phone || '',
      linkedin: data.linkedin || '',
      sequenceType: data.sequenceType || 'linkedin',
      notes: data.notes || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      createdBy: data.createdBy || '',
    };
  }

  /**
   * Fetches all leads created by a specific user.
   */
  async getLeadsByUser(userId: string): Promise<Lead[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => this.mapDocToLead(docSnap));
    } catch {
      const fallbackQuery = query(
        collection(db, this.collectionName),
        where('createdBy', '==', userId)
      );
      const snapshot = await getDocs(fallbackQuery);
      const leads = snapshot.docs.map((docSnap) => this.mapDocToLead(docSnap));
      return leads.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }
  }

  /**
   * Fetches a single lead by ID and verifies owner user ID.
   */
  async getLeadById(userId: string, leadId: string): Promise<Lead | null> {
    const docRef = doc(db, this.collectionName, leadId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const lead = this.mapDocToLead(docSnap as QueryDocumentSnapshot<DocumentData>);
    if (lead.createdBy !== userId) {
      throw new Error('Access denied: You do not own this lead.');
    }

    return lead;
  }

  /**
   * Creates a new lead in Firestore for the specified user.
   */
  async createLead(userId: string, input: CreateLeadInput): Promise<Lead> {
    const now = new Date().toISOString();
    const leadData = {
      ...input,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, this.collectionName), leadData);
    return {
      id: docRef.id,
      ...leadData,
    };
  }

  /**
   * Updates an existing lead in Firestore after verifying owner.
   */
  async updateLead(userId: string, leadId: string, input: UpdateLeadInput): Promise<void> {
    const existing = await this.getLeadById(userId, leadId);
    if (!existing) {
      throw new Error('Lead not found.');
    }

    const docRef = doc(db, this.collectionName, leadId);
    const updateData = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, updateData);
  }

  /**
   * Deletes a lead from Firestore after verifying owner.
   */
  async deleteLead(userId: string, leadId: string): Promise<void> {
    const existing = await this.getLeadById(userId, leadId);
    if (!existing) {
      throw new Error('Lead not found.');
    }

    const docRef = doc(db, this.collectionName, leadId);
    await deleteDoc(docRef);
  }
}

export const leadRepository = new LeadRepository();
