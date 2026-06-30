import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export function CollapsibleFieldSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-gray-100">
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 text-sm font-semibold text-gray-700 hover:text-[#013f7c]">
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        {title}
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pb-3">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default CollapsibleFieldSection;