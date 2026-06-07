cat > /Users/e2ret/Desktop/rflab/start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
open http://localhost:5173
npm run dev
EOF
chmod +x /Users/e2ret/Desktop/rflab/start.sh