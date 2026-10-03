import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/asset/weekly");
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      fontFamily: 'system-ui, sans-serif',
      background: '#0a0a0a',
      color: '#ffffff'
    }}>
      Redirecting to dashboard...
    </div>
  );
}

