def TIMESTAMP = Calendar.getInstance().getTime().format('YYYYMMdd-hhmm')

pipeline {
  agent {
    label "docker"
  }

  options {
    disableConcurrentBuilds()
    parallelsAlwaysFailFast()
  }

  environment {
    sonarqube_name    = "Demo-API"
    sonarqube_url     = "https://eris.gbhapps.com"
    sonarqube_token   = credentials('sonar_token')
    nodeEnv           = "development"
    repoBaseURL       = "git@github.com:soluciones-gbh"
    webPath           = "/srv/demo-webapp"
    officeWebhookUrl  = "https://outlook.office.com/webhook/fd2e0e97-97df-4057-a9df-ff2e0c66196a@64aa16ab-5980-47d5-a944-3f8cc9bbdfa2/IncomingWebhook/6c2ab55478d146efbe4041db69f97108/217bfa4b-9515-4221-b5b7-6858ebd6d4b5"
  }

  parameters {
    string(
      name: "webBranch",
      defaultValue: "master",
      description: "Demo Webapp Branch"
    )
  }

  stages {
    stage("Environment") {
      steps {
        script {

          /* Obtain dynamic/custom variables necessary for this CI job */
          hostPublic = getHostName()
          apiBranch = "${env.CHANGE_BRANCH}"
          webRepo = "${repoBaseURL}/demo-webapp.git"
          webBranch = getBranchForRepo(webRepo, apiBranch, params.webBranch)

          /* Print all the variables assigned in this stage. */
          prettyPrint("ReviewApp URL: ${hostPublic}")
          prettyPrint("API Branch: ${apiBranch}")
          prettyPrint("Web Branch: ${webBranch}")

        }
      }
      post {
        success {
          office365ConnectorSend color: "05b222", message: "CI pipeline for ${apiBranch} initialized. ReviewApp will be available at: http://${hostPublic}.", status: "STARTED", webhookUrl: "${officeWebhookUrl}"
        }
      }
    }

    stage("Repositories") {
      parallel {
        stage("CloningWEB") {
          steps {
            cloneProject("/srv", webRepo, webBranch)
          }
        }
      }
    }

    stage("Setup & Test") {
      parallel {
        stage("Build") {
          steps {
            echo "This step will configure the application to be provisioned as a Review environment."
            sh(
              label: "Building API docker images...",
              script: "docker-compose build --no-cache"
            )
            sh(
              label: "Adding API_URL to dotenv...",
              script: "sed -i 's|REACT_APP_API_URL=.*|REACT_APP_API_URL=http://${hostPublic}:3001|' ${webPath}/.env.example"
            )
            sh(
              label: "Building WebApp docker images...",
              script: "cd ${webPath} && docker-compose build --no-cache"
            )
          }
        }
        stage('SAST') {
          steps {
            script {
              jiraId = getTicketIdFromBranchName("${apiBranch}");
            }
            echo "This step will test the code with sonarqube"
            sh(
              label: "Testing with sonarqube",
              script: """
              sonar-scanner \
                  -Dsonar.projectName=${sonarqube_name} \
                  -Dsonar.projectKey=${sonarqube_name} \
                  -Dsonar.sources=. \
                  -Dsonar.host.url=${sonarqube_url} \
                  -Dsonar.login=${sonarqube_token} \
                  -Dsonar.projectVersion=${jiraId}
              """
            )
          }
        }
      }
    }

    stage("Initialize") {
      options {
        timeout(
          time: 15,
          unit: "MINUTES"
        )
      }
      steps {
        echo "This step will configure the application to be provisioned as a Review environment."
        sh(
          label: "Spinning up the API containers...",
          script: "docker-compose up -d"
        )
        sh(
          label: "Spinning up the WebApp containers...",
          script: "cd ${webPath} && docker-compose up -d"
        )
        input message: "Do you want to start the validation process? Pipeline will self-destruct in 15 minutes if no input is provided."
      }
    }

    stage("Validation") {
      parallel {
        stage("Kanon") {
          options {
            timeout(
              time: 4,
              unit: "HOURS"
              )
          }
          steps {
            script {
              jiraId = getTicketIdFromBranchName("${apiBranch}");
            }
            sh(
              label: "Posting ReviewApp data to Kanon...",
              script: """
                curl \
                  -H "Content-Type: application/json" \
                  -H "authToken: as5uNvV5bKAa4Bzg24Bc" \
                  -d '{"branch": "${apiBranch}", "apiURL": "http://${hostPublic}:3001", "jiraIssueKey": "${jiraId}", "build": "${BUILD_NUMBER}", "webAppLink": "${hostPublic}"}' \
                  -X POST \
                  https://kanon-api.gbhlabs.net/api/reviewapps
              """
            )  
            prettyPrint("ReviewApp URL: http://${hostPublic}")
            echo getTaskLink(apiBranch)
            input message: "Validation finished?"
          }
        }
        stage("DAST") {
          steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
              sh(
                label: "Scaning App with ZAP",
                script: """
                  docker run -t owasp/zap2docker-stable zap-api-scan.py -t http://${hostPublic}:3001 -f openapi
                """
              )
            }
          }
        }
      }
    }
  }

  post {
    failure {
      office365ConnectorSend color: "f40909", message: "CI pipeline for ${apiBranch} failed. Please check the logs for more information.", status: "FAILED", webhookUrl: "${officeWebhookUrl}"
    }
    success {
      office365ConnectorSend color:"50bddf", message: "CI pipeline for ${apiBranch} completed succesfully.", status:"SUCCESS", webhookUrl:"${officeWebhookUrl}"
    }
    always {
      sh(
        label: "Posting ReviewApp status to Kanon...",
        script: """
          curl \
            -H "Content-Type: application/json" \
            -H "authToken: as5uNvV5bKAa4Bzg24Bc" \
            -X POST \
            https://kanon-api.gbhlabs.net/api/reviewapps/deactivation?build=${BUILD_NUMBER}\\&branch=${apiBranch}
        """
      )
      sh(
        label: "Cleaning up API containers...",
        script: "docker-compose down --remove-orphans --volumes --rmi local"
      )
      sh(
        label: "Cleaning up WebApp containers...",
        script: "cd ${webPath} && docker-compose down --remove-orphans --volumes --rmi local"
      )
      sh(
        label: "Cleaning up directories...",
        script: "rm -rf ${webPath}"
      )
    }
  }
}

/*
 * Gets the public DNS name of the provisioned instance used to run this pipeline.
 * https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-instance-addressing.html
 */
def getHostName() {
  metadataUrl = "http://169.254.169.254/latest/meta-data/public-hostname"
  return sh(
    label: "Fetching host URL...",
    script: "curl ${metadataUrl}",
    returnStdout: true
  ).trim()
}

/*
 * Prints the message using sh label.
 */
def prettyPrint(String message) {
  sh(
    label: message,
    script: "echo ${message}"
  )
}

/*
 * Obtains the matching branch of another repository. This is used to fetch
 * a change that requires multiple repositories to be properly tested in
 * the continuous integration pipeline.
 */
def getBranchForRepo(String repo, String branchToCheck, String defaultBranch) {
  exists = sh(
    label: "Checking if ${branchToCheck} exists on ${repo}.",
    script: "git ls-remote --heads --exit-code ${repo} ${branchToCheck}.",
    returnStatus: true
  ) == 0

  if (exists) {
    return branchToCheck
  }

  if (defaultBranch == "master") {
    return "master"
  }

  return defaultBranch
}

/*
 * Get the task URL associated with this change.
 */
def getTaskLink(String branch) {
  def taskRegex = /IA-[0-9]+/
  def match = branch =~ taskRegex

  if (match.size() == 1) {
    return "Task link: https://gbhapps.atlassian.net/browse/${match[0]}"
  }
  return "Could not get this branch task URL."
}

/*
 * Go to the given project path and makes sure the project is on the given branch.
 */
def cloneProject(String path, String repo, String branch) {
  sh(
    label: "Updating ${path} repository...",
    script: "cd ${path} && git clone -b ${branch} ${repo}"
  )
}

/*
 * Get the ticket ID using the branch name.
 */
def getTicketIdFromBranchName(String branchName) {
  return branchName.findAll(/(DP-[0-9]+)/)[0];
}
