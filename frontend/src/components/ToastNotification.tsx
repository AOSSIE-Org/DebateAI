import { useEffect } from "react";
import { ToastNotificationAtom } from "@/atoms/ToastNotificationAtom";
import { useRecoilState } from "recoil";
import { motion, AnimatePresence } from "framer-motion";

const ToastNotification: React.FC = () => {
  const [toastnotification, setToastNotification] = useRecoilState(ToastNotificationAtom);

  useEffect(() => {
    if (toastnotification.visible) {
      const toastTime = setTimeout(() => {
        setToastNotification({
          message: "",
          colour: "",
          visible: false,
        });
      }, 3000);

      return () => clearTimeout(toastTime);
    }
  }, [toastnotification, setToastNotification]);

  return (
    <AnimatePresence>
      {toastnotification.visible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={`fixed z-50 p-2 bottom-4 right-4 text-white rounded-sm ${
            toastnotification.colour === "green" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toastnotification.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ToastNotification;
