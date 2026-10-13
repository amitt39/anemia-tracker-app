--
-- PostgreSQL database dump
--

\restrict Ok380YdMsbede4qi6a6WWVZ9mim6gxLsh4z2BIu6cG5NBSmSekePHpQcDb6LCZu

-- Dumped from database version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: classrooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classrooms (
    classroom_id integer NOT NULL,
    school_id integer NOT NULL,
    teacher_id integer,
    class_name character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: classrooms_classroom_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classrooms_classroom_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classrooms_classroom_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classrooms_classroom_id_seq OWNED BY public.classrooms.classroom_id;


--
-- Name: hb_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hb_tests (
    test_id integer NOT NULL,
    student_id integer NOT NULL,
    test_date date NOT NULL,
    hb_level numeric(4,1) NOT NULL,
    recorded_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT hb_tests_hb_level_check CHECK (((hb_level >= 2.0) AND (hb_level <= 25.0)))
);


--
-- Name: hb_tests_test_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hb_tests_test_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hb_tests_test_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hb_tests_test_id_seq OWNED BY public.hb_tests.test_id;


--
-- Name: parents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parents (
    parent_id integer NOT NULL,
    phone_number character varying(20) NOT NULL,
    expo_push_token text,
    phone_verified_at timestamp without time zone,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT parents_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: parents_parent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parents_parent_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parents_parent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parents_parent_id_seq OWNED BY public.parents.parent_id;


--
-- Name: schools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schools (
    school_id integer NOT NULL,
    school_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: schools_school_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schools_school_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schools_school_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schools_school_id_seq OWNED BY public.schools.school_id;


--
-- Name: student_parents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_parents (
    student_id integer NOT NULL,
    parent_id integer NOT NULL,
    relationship character varying(30),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_parents_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'verified'::character varying])::text[])))
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    student_id integer NOT NULL,
    classroom_id integer NOT NULL,
    roll_number integer NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    is_flagged boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT students_roll_number_check CHECK ((roll_number > 0))
);


--
-- Name: students_student_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.students_student_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: students_student_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.students_student_id_seq OWNED BY public.students.student_id;


--
-- Name: tablet_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tablet_courses (
    course_id integer NOT NULL,
    student_id integer NOT NULL,
    test_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT tablet_courses_check CHECK ((end_date >= start_date))
);


--
-- Name: tablet_courses_course_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tablet_courses_course_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tablet_courses_course_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tablet_courses_course_id_seq OWNED BY public.tablet_courses.course_id;


--
-- Name: tablet_doses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tablet_doses (
    dose_id integer NOT NULL,
    course_id integer NOT NULL,
    scheduled_date date NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    taken_at timestamp without time zone,
    reported_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT tablet_doses_check CHECK (((((status)::text = 'scheduled'::text) AND (taken_at IS NULL) AND (reported_by IS NULL)) OR (((status)::text = 'taken'::text) AND (taken_at IS NOT NULL) AND (reported_by IS NOT NULL)))),
    CONSTRAINT tablet_doses_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'taken'::character varying])::text[])))
);


--
-- Name: tablet_doses_dose_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tablet_doses_dose_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tablet_doses_dose_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tablet_doses_dose_id_seq OWNED BY public.tablet_doses.dose_id;


--
-- Name: teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teachers (
    teacher_id integer NOT NULL,
    school_id integer NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: teachers_teacher_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teachers_teacher_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teachers_teacher_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teachers_teacher_id_seq OWNED BY public.teachers.teacher_id;


--
-- Name: classrooms classroom_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classrooms ALTER COLUMN classroom_id SET DEFAULT nextval('public.classrooms_classroom_id_seq'::regclass);


--
-- Name: hb_tests test_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hb_tests ALTER COLUMN test_id SET DEFAULT nextval('public.hb_tests_test_id_seq'::regclass);


--
-- Name: parents parent_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents ALTER COLUMN parent_id SET DEFAULT nextval('public.parents_parent_id_seq'::regclass);


--
-- Name: schools school_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools ALTER COLUMN school_id SET DEFAULT nextval('public.schools_school_id_seq'::regclass);


--
-- Name: students student_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students ALTER COLUMN student_id SET DEFAULT nextval('public.students_student_id_seq'::regclass);


--
-- Name: tablet_courses course_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_courses ALTER COLUMN course_id SET DEFAULT nextval('public.tablet_courses_course_id_seq'::regclass);


--
-- Name: tablet_doses dose_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_doses ALTER COLUMN dose_id SET DEFAULT nextval('public.tablet_doses_dose_id_seq'::regclass);


--
-- Name: teachers teacher_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers ALTER COLUMN teacher_id SET DEFAULT nextval('public.teachers_teacher_id_seq'::regclass);


--
-- Name: classrooms classrooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classrooms
    ADD CONSTRAINT classrooms_pkey PRIMARY KEY (classroom_id);


--
-- Name: classrooms classrooms_school_id_class_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classrooms
    ADD CONSTRAINT classrooms_school_id_class_name_key UNIQUE (school_id, class_name);


--
-- Name: hb_tests hb_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hb_tests
    ADD CONSTRAINT hb_tests_pkey PRIMARY KEY (test_id);


--
-- Name: parents parents_expo_push_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_expo_push_token_key UNIQUE (expo_push_token);


--
-- Name: parents parents_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_phone_number_key UNIQUE (phone_number);


--
-- Name: parents parents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_pkey PRIMARY KEY (parent_id);


--
-- Name: schools schools_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_email_key UNIQUE (email);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (school_id);


--
-- Name: student_parents student_parents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_parents
    ADD CONSTRAINT student_parents_pkey PRIMARY KEY (student_id, parent_id);


--
-- Name: students students_classroom_id_roll_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_classroom_id_roll_number_key UNIQUE (classroom_id, roll_number);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (student_id);


--
-- Name: tablet_courses tablet_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_courses
    ADD CONSTRAINT tablet_courses_pkey PRIMARY KEY (course_id);


--
-- Name: tablet_courses tablet_courses_student_id_test_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_courses
    ADD CONSTRAINT tablet_courses_student_id_test_id_key UNIQUE (student_id, test_id);


--
-- Name: tablet_doses tablet_doses_course_id_scheduled_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_doses
    ADD CONSTRAINT tablet_doses_course_id_scheduled_date_key UNIQUE (course_id, scheduled_date);


--
-- Name: tablet_doses tablet_doses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_doses
    ADD CONSTRAINT tablet_doses_pkey PRIMARY KEY (dose_id);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (teacher_id);


--
-- Name: teachers teachers_school_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_school_id_email_key UNIQUE (school_id, email);


--
-- Name: teachers teachers_teacher_id_school_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_teacher_id_school_id_key UNIQUE (teacher_id, school_id);


--
-- Name: classrooms classrooms_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classrooms
    ADD CONSTRAINT classrooms_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(school_id);


--
-- Name: classrooms classrooms_teacher_id_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classrooms
    ADD CONSTRAINT classrooms_teacher_id_school_id_fkey FOREIGN KEY (teacher_id, school_id) REFERENCES public.teachers(teacher_id, school_id);


--
-- Name: hb_tests hb_tests_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hb_tests
    ADD CONSTRAINT hb_tests_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.teachers(teacher_id);


--
-- Name: hb_tests hb_tests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hb_tests
    ADD CONSTRAINT hb_tests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id);


--
-- Name: student_parents student_parents_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_parents
    ADD CONSTRAINT student_parents_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(parent_id);


--
-- Name: student_parents student_parents_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_parents
    ADD CONSTRAINT student_parents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id);


--
-- Name: students students_classroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(classroom_id);


--
-- Name: tablet_courses tablet_courses_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_courses
    ADD CONSTRAINT tablet_courses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id);


--
-- Name: tablet_courses tablet_courses_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_courses
    ADD CONSTRAINT tablet_courses_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.hb_tests(test_id);


--
-- Name: tablet_doses tablet_doses_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_doses
    ADD CONSTRAINT tablet_doses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.tablet_courses(course_id);


--
-- Name: tablet_doses tablet_doses_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tablet_doses
    ADD CONSTRAINT tablet_doses_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.parents(parent_id);


--
-- Name: teachers teachers_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(school_id);


--
-- PostgreSQL database dump complete
--

\unrestrict Ok380YdMsbede4qi6a6WWVZ9mim6gxLsh4z2BIu6cG5NBSmSekePHpQcDb6LCZu

