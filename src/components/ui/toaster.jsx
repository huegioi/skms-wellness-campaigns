import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster({ position = "bottom-right", closeButton = true }) {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, open = true, ...props }) {
        return (
          <Toast key={id} {...props} open={open} onOpenChange={(isOpen) => !isOpen && dismiss(id)}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            {closeButton && <ToastClose onClick={() => dismiss(id)} />}
          </Toast>
        );
      })}
      <ToastViewport className={position === "bottom-right" ? "bottom-0 right-0" : ""} />
    </ToastProvider>
  );
}