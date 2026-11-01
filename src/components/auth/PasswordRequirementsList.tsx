import React from 'react';
import { Check, X } from 'lucide-react';
import { checkPasswordRequirements, PasswordRequirements } from '@/utils/validation';

interface PasswordRequirementsListProps {
  password: string;
  showAlways?: boolean;
}

export const PasswordRequirementsList: React.FC<PasswordRequirementsListProps> = ({
  password,
  showAlways = false,
}) => {
  const reqs = checkPasswordRequirements(password);

  // If empty and not showAlways, don't display
  if (!password && !showAlways) return null;

  const items = [
    { label: 'At least 8 characters', met: reqs.hasMinLength },
    { label: 'One uppercase letter', met: reqs.hasUppercase },
    { label: 'One lowercase letter', met: reqs.hasLowercase },
    { label: 'One number', met: reqs.hasNumber },
    { label: 'One special character', met: reqs.hasSpecialChar },
  ];

  return (
    <div className="mt-2.5 p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-xs space-y-1.5 transition-all">
      <span className="font-semibold text-[#475569] block mb-1">Password requirements:</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-1.5 transition-colors ${
              item.met ? 'text-emerald-600 font-medium' : 'text-slate-400'
            }`}
          >
            {item.met ? (
              <div className="h-3.5 w-3.5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-emerald-600 stroke-[3]" />
              </div>
            ) : (
              <div className="h-3.5 w-3.5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <div className="h-1 w-1 rounded-full bg-slate-400" />
              </div>
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

