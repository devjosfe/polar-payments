import React from 'react'

function Footer() {
  return (
    <footer style={styles.footer}>
      <p style={styles.text}> 2025 SurveyInsights. All rights reserved.</p>
    </footer>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  footer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#333',
    color: '#fff',
  },
  text: {
    margin: 0,
    fontSize: '14px',
  },
}

export default Footer