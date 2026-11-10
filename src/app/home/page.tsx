import Overview from "@/components/Overview"

export default function Home() {
    // const [loading, setLoading] = useState(true);

    // useEffect(() => {
    //     const timeout = window.setTimeout(() => setLoading(false), 500);
    //     return () => window.clearTimeout(timeout);
    // }, []);

    return (
        <>
            <Overview />
        </>
    );
}
