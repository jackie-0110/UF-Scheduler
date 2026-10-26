import React from "react";
import LinkedInProfileBadge from "react-linkedin-profile-badge";
import Footer from "../../components/Footer/Footer";
import "../../components/Header/HeaderStyles.css";
import "./AboutStyles.css";

const AboutPage: React.FC = () => {
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
            About
          </h1>
          <p
            style={{
              lineHeight: "1.6",
              fontSize: "1.2em",
              marginBottom: "20px",
            }}
          >
            Created by Andy Chen and Ronak Agarwal in June 2023.
          </p>
          <p
            style={{
              lineHeight: "1.6",
              fontSize: "1.2em",
              marginBottom: "20px",
            }}
          >
            Maintained and updated weekly by Andy Chen since July 2023.{" "}
          </p>
          <p
            style={{
              lineHeight: "1.6",
              fontSize: "1.2em",
              marginBottom: "20px",
            }}
          >
            UF Scheduler is a website that aims to help students plan their
            schedules. It is not affiliated with the University of Florida.
          </p>
          <h2
            style={{
              fontSize: "1.75em",
              marginBottom: "10px",
              marginTop: "30px",
            }}
          >
            Credits
          </h2>
          <p
            style={{
              lineHeight: "1.6",
              fontSize: "1.2em",
              marginBottom: "20px",
            }}
          >
            <a href="https://www.linkedin.com/in/danielurbonas/" target="_blank" rel="noreferrer" className="text-accent-1 hover:underline">Daniel Urbonas</a> - AI chat assistant
          </p>
          <h2
            style={{
              fontSize: "1.75em",
              marginBottom: "10px",
              marginTop: "30px",
            }}
          >
            Contact
          </h2>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
            }}
          >
            <a
              href="mailto: andy.chen@ufl.edu"
              className="text-accent-1 hover:underline"
              style={{ lineHeight: "1.6", fontSize: "1.2em" }}
            >
              andy.chen@ufl.edu
            </a>
            <LinkedInProfileBadge
              profileId="andy-chen67"
              theme="light"
              size="large"
              orientation="horizontal"
            />
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
};

export default AboutPage;
