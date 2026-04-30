import { useEffect, useState }  from "react";
import API from "../api";

function Dashboard(){
    const [stats, setStats] = useState(null);

    useEffect(() => {
        API.get("stats/")
        .then((res) => {
            setStats(res.data);
        })
        .catch((err) => {
            console.log(err);
        });
    }, []);

    return(
        <div>
            <h1>Dashboard</h1>
            {stats && <p>Total Focus Time: {stats.total_focus_time}</p>}
        </div>
    );
}

export default Dashboard;