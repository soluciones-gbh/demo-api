pipeline {
  agent {
    label "docker"
  }

  options {
    disableConcurrentBuilds()
    parallelsAlwaysFailFast()
  }

  environment {
    nodeEnv = "development"
    repoBaseURL = "git@github.com:soluciones-gbh"
    webPath = "/srv/demo-webapp"
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
    }

    stage("Repositories") {
      parallel {
        stage('CloningWEB') {
          steps {
            cloneProject("/srv", webRepo, webBranch)
          }
        }
      }
    }

    stage('Setup') {
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

    stage('Initialize') {
      options {
        timeout(time: 15, unit: 'MINUTES')
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
        sh(
          label: "Sleep for 5 seconds to ensure containers are healthy...",
          script: "sleep 5"
        )

        input message: 'Do you want to start the validation process? Pipeline will self-destruct in 15 minutes if no input is provided.'
      }
    }

    stage('Validation') {
      options {
        timeout(time: 4, unit: 'HOURS')
      }
      steps {
        prettyPrint("ReviewApp URL: http://${hostPublic}")
        echo getTaskLink(apiBranch)
        input message: 'Validation finished?'
      }
    }
  }

  post {
    always {
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
  metadataUrl = 'http://169.254.169.254/latest/meta-data/public-hostname'

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
  sh(label: message, script: "echo ${message}")
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

  if (defaultBranch == 'master') {
    return 'master'
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

/**
 * Go to the given project path and makes sure the project is on the given branch.
 */
def cloneProject(String path, String repo, String branch) {
  sh(
    label: "Updating ${path} repository...",
    script: "cd ${path} && git clone -b ${branch} ${repo} "
  )
}
