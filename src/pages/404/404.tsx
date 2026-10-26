import React from "react";
import Footer from "../../components/Footer/Footer";
import "../../components/Header/HeaderStyles.css";
import "../About/AboutStyles.css"

const Fourohfour: React.FC = () => {
  return (
    <>
      <header className="header page-header">
        <a href="/" className="brand">
          <img src="/csu_logo.svg" alt="UF CSU" className="brand-logo" />
          <span className="title">UF Scheduler</span>
        </a>
      </header>
      <div
        className="static-page"
        style={{ minHeight: "100vh", padding: "50px" }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "2.5em",
              marginBottom: "10px",
              marginTop: "40px",
            }}
          >
            How did you get here?
          </h1>
          <p
            style={{
              lineHeight: "1.6",
              fontSize: "1.2em",
              marginBottom: "20px",
            }}
          >
            404 not found.
          </p>
        </div>
        <Footer />
      </div>
    </>
  );
};

export default Fourohfour;
