import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  }
};

const item: Variants = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.8, 0.25, 1]
    }
  }
};

type Props = {
  children: ReactNode;
};

export const MotionContainer = ({ children }: Props) => (
  <motion.div
    variants={container}
    initial="hidden"
    animate="show"
  >
    {children}
  </motion.div>
);

export const MotionItem = ({ children }: Props) => (
  <motion.div variants={item}>
    {children}
  </motion.div>
);