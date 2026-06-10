'use client';

import { motion } from 'framer-motion';

export function Authority() {
  return (
    <section 
      className="py-24 px-6 md:px-12 lg:px-24 relative"
      style={{
        background: 'var(--gray-900)',
      }}
    >
      <div className="container mx-auto max-w-3xl text-center">
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-heading font-light mb-8 leading-relaxed"
          style={{
            fontFamily: 'var(--font-deep-tech-body)',
            fontWeight: 200,
            color: 'var(--titanium-white)',
          }}
        >
          "Genesis n'augmente pas artificiellement votre motivation. Il identifie si une transformation est possible, à quel rythme, et à quelles conditions."
        </motion.blockquote>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg"
          style={{
            fontFamily: 'var(--font-deep-tech-body)',
            color: 'var(--gray-400)',
          }}
        >
          Dans certains cas, la stratégie optimale n'est pas d'accélérer… mais de restaurer la capacité à transformer.
        </motion.p>
      </div>
    </section>
  );
}











