# _sources/INDEX.md - Source Files Map

This file maps the raw source documents to the sections of the `cv.json` file. These files are considered immutable inputs.

| File Name | Type | Content Description | Sections Feed |
| :--- | :--- | :--- | :--- |
| `Currículo Profissional André Câmara - 21.10.2025.pdf` | PDF | Resume (Summary) | `profile`, `experience`, `languages` |
| `Diploma 12Ano.pdf` | PDF | High School Diploma | `education` |
| `EFA .Programadora-de-Informatica_Profissional.pdf` | PDF | Training Plan (Programmer) | `training` |
| `Extended CV - André Câmara - 17.09.2025.pdf` | PDF | Detailed Resume | `profile`, `about`, `experience`, `skills`, `education`, `training`, `languages` |
| `Marketing Digital.pdf` | PDF | Digital Marketing Certificate | `training` |
| `Passaporte_qualifica.pdf` | PDF | Official Skills Passport | `training`, `education`, `certificates` |
| `SOs_Windows_e_Linux-Certificado_SOs_Windows_e_Linux_4864.pdf` | PDF | Operating Systems Certificate | `training` |
| `Tabela de competencias.pdf` | PDF | Technical Skills Table | `skills` |
| `certificate-advanced-course-in-programming-2025.png` | PNG | MOOC Advanced Programming | `training` |
| `certificate-introduction-to-programming-2025.png` | PNG | MOOC Intro Programming | `training` |

### Precedence Rules
1. **Profile/Experience**: `Currículo Profissional André Câmara - 21.10.2025.pdf` (Latest).
2. **Education/Training**: Official PDF certificates and `Passaporte_qualifica.pdf`.
3. **Skills**: `Tabela de competencias.pdf` (detailed auto-evaluation).

*Note: Sensitive data (phone, address, birthdate) is marked as `private` by default in `cv.json`.*
